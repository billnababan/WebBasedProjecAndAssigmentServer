const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")

// Request project completion (for employees)
const requestProjectCompletion = async (req, res) => {
  const { id } = req.params // Project UUID
  const { evidence, notes } = req.body
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const attachments = req.files // Multiple files from multer

  try {
    // Only employees can request project completion
    if (userRole !== "employee") {
      return res.status(403).json({
        success: false,
        error: "Only employees can request project completion",
      })
    }

    // Check if project exists
    const project = await query(`SELECT * FROM project WHERE uuid = ?`, [id])

    if (project.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Project not found",
      })
    }

    // Check if project is already completed
    if (project[0].status === "Completed") {
      return res.status(400).json({
        success: false,
        error: "Project is already completed",
      })
    }

    // Check if there's already a pending completion request
    const existingRequest = await query(
      `SELECT * FROM project_completion_requests WHERE project_uuid = ? AND status = 'pending'`,
      [id],
    )

    if (existingRequest.length > 0) {
      return res.status(400).json({
        success: false,
        error: "There is already a pending completion request for this project",
      })
    }

    // Create a new completion request
    const requestUuid = uuidv4()

    // Process attachments if any
    let attachmentPaths = []
    if (attachments && attachments.length > 0) {
      attachmentPaths = attachments.map((file) => file.path)
    }

    await query(
      `INSERT INTO project_completion_requests 
      (uuid, project_uuid, user_uuid, evidence, notes, attachments, status, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestUuid,
        id,
        userUuid,
        evidence,
        notes,
        attachmentPaths.length > 0 ? attachmentPaths.join(",") : null,
        "pending",
        new Date(),
        new Date(),
      ],
    )

    // Update project status to "Pending Review"
    await query(`UPDATE project SET  updated_At = ? WHERE uuid = ?`, [ new Date(), id])

    return res.status(200).json({
      success: true,
      message: "Project completion request submitted successfully",
      requestId: requestUuid,
    })
  } catch (error) {
    console.error("Error in requestProjectCompletion:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your request",
    })
  }
}

// Review project completion request (for admins)
const reviewProjectCompletion = async (req, res) => {
  const { id } = req.params // Request UUID
  const { status, feedback } = req.body
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    // Only admins can review completion requests
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only admins can review project completion requests",
      })
    }

    // Check if request exists
    const request = await query(`SELECT * FROM project_completion_requests WHERE uuid = ?`, [id])

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Completion request not found",
      })
    }

    // Check if request is already reviewed
    if (request[0].status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "This request has already been reviewed",
      })
    }

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status. Use 'approved' or 'rejected'",
      })
    }

    // Update request status
    await query(
      `UPDATE project_completion_requests 
      SET status = ?, feedback = ?, reviewer_uuid = ?, updated_At = ? 
      WHERE uuid = ?`,
      [status, feedback, userUuid, new Date(), id],
    )

    // If approved, update project status to "Completed"
    if (status === "approved") {
      await query(
        `UPDATE project 
        SET status = ?, completed_At = ?, updated_At = ? 
        WHERE uuid = ?`,
        ["Completed", new Date(), new Date(), request[0].project_uuid],
      )
    } else {
      // If rejected, revert project status to "In Progress"
      await query(
        `UPDATE project 
        SET status = ?, updated_At = ? 
        WHERE uuid = ?`,
        ["In Progress", new Date(), request[0].project_uuid],
      )
    }

    return res.status(200).json({
      success: true,
      message: `Completion request ${status}`,
    })
  } catch (error) {
    console.error("Error in reviewProjectCompletion:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your request",
    })
  }
}

// Get completion requests for a project
const getProjectCompletionRequests = async (req, res) => {
  const { projectId } = req.params
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    let requests

    // If admin, get all requests for the project
    if (userRole === "admin") {
      requests = await query(
        `SELECT pcr.*, u.username as requester_name, 
                r.username as reviewer_name
         FROM project_completion_requests pcr
         LEFT JOIN users u ON pcr.user_uuid = u.uuid
         LEFT JOIN users r ON pcr.reviewer_uuid = r.uuid
         WHERE pcr.project_uuid = ?
         ORDER BY pcr.created_At DESC`,
        [projectId],
      )
    } else {
      // If employee, only get their own requests
      requests = await query(
        `SELECT pcr.*, u.username as requester_name, 
                r.username as reviewer_name
         FROM project_completion_requests pcr
         LEFT JOIN users u ON pcr.user_uuid = u.uuid
         LEFT JOIN users r ON pcr.reviewer_uuid = r.uuid
         WHERE pcr.project_uuid = ? AND pcr.user_uuid = ?
         ORDER BY pcr.created_At DESC`,
        [projectId, userUuid],
      )
    }

    return res.status(200).json({
      success: true,
      data: requests,
      message: "Completion requests fetched successfully",
    })
  } catch (error) {
    console.error("Error in getProjectCompletionRequests:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching completion requests",
    })
  }
}

// Get all pending project completion requests (for admins)
const getPendingProjectCompletionRequests = async (req, res) => {
  const userRole = req.user.role

  try {
    // Only admins can view all pending requests
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only admins can view all pending project completion requests",
      })
    }

    const requests = await query(
      `SELECT pcr.*, p.project_name, p.uuid as project_uuid, u.username as requester_name
       FROM project_completion_requests pcr
       JOIN project p ON pcr.project_uuid = p.uuid
       JOIN users u ON pcr.user_uuid = u.uuid
       WHERE pcr.status = 'pending'
       ORDER BY pcr.created_At DESC`,
    )

    return res.status(200).json({
      success: true,
      data: requests,
      message: "Pending project completion requests fetched successfully",
    })
  } catch (error) {
    console.error("Error in getPendingProjectCompletionRequests:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching pending requests",
    })
  }
}

module.exports = {
  requestProjectCompletion,
  reviewProjectCompletion,
  getProjectCompletionRequests,
  getPendingProjectCompletionRequests,
}
