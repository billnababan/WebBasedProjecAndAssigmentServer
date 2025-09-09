const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")

// Request task completion (for employees)
const requestTaskCompletion = async (req, res) => {
  const { id } = req.params // Task UUID
  const { evidence, notes } = req.body
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const attachments = req.files // Multiple files from multer

  try {
    // Only employees can request task completion
    if (userRole !== "employee") {
      return res.status(403).json({
        success: false,
        error: "Only employees can request task completion",
      })
    }

    // Check if task exists and is assigned to the user
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND user_uuid = ?`, [id, userUuid])

    if (task.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found or not assigned to you",
      })
    }

    // Check if task is already completed
    if (task[0].status === "Completed") {
      return res.status(400).json({
        success: false,
        error: "Task is already completed",
      })
    }

    // Check if there's already a pending completion request
    const existingRequest = await query(
      `SELECT * FROM task_completion_requests WHERE task_uuid = ? AND status = 'pending'`,
      [id],
    )

    if (existingRequest.length > 0) {
      return res.status(400).json({
        success: false,
        error: "There is already a pending completion request for this task",
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
      `INSERT INTO task_completion_requests 
      (uuid, task_uuid, user_uuid, evidence, notes, attachments, status, created_At, updated_At)
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

    // Keep task status as "In Progress" since "Pending Review" is not a valid enum value
    // The frontend can check for pending completion requests to show a "Pending Review" state
    await query(`UPDATE task SET updated_At = ? WHERE uuid = ?`, [new Date(), id])

    return res.status(200).json({
      success: true,
      message: "Task completion request submitted successfully",
      requestId: requestUuid,
    })
  } catch (error) {
    console.error("Error in requestTaskCompletion:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your request",
    })
  }
}

// Review task completion request (for managers)
const reviewTaskCompletion = async (req, res) => {
  const { id } = req.params // Request UUID
  const { status, feedback } = req.body
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    // Only managers can review completion requests
    if (userRole !== "manager" ) {
      return res.status(403).json({
        success: false,
        error: "Only managers can review completion requests",
      })
    }

    // Check if request exists
    const request = await query(`SELECT * FROM task_completion_requests WHERE uuid = ?`, [id])

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
      `UPDATE task_completion_requests 
      SET status = ?, feedback = ?, reviewer_uuid = ?, updated_At = ? 
      WHERE uuid = ?`,
      [status, feedback, userUuid, new Date(), id],
    )

    // If approved, update task status to "Completed"
    if (status === "approved") {
      await query(
        `UPDATE task 
        SET status = ?, completed_At = ?, updated_At = ? 
        WHERE uuid = ?`,
        ["Completed", new Date(), new Date(), request[0].task_uuid],
      )
    } else {
      // If rejected, keep task status as "In Progress"
      await query(
        `UPDATE task 
        SET updated_At = ? 
        WHERE uuid = ?`,
        [new Date(), request[0].task_uuid],
      )
    }

    return res.status(200).json({
      success: true,
      message: `Completion request ${status}`,
    })
  } catch (error) {
    console.error("Error in reviewTaskCompletion:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while processing your request",
    })
  }
}

// Get completion requests for a task
const getTaskCompletionRequests = async (req, res) => {
  const { taskId } = req.params
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    let requests

    // If manager/admin, get all requests for the task
    if (userRole === "manager" || userRole === "admin") {
      requests = await query(
        `SELECT tcr.*, u.username as requester_name, 
                r.username as reviewer_name
         FROM task_completion_requests tcr
         LEFT JOIN users u ON tcr.user_uuid = u.uuid
         LEFT JOIN users r ON tcr.reviewer_uuid = r.uuid
         WHERE tcr.task_uuid = ?
         ORDER BY tcr.created_At DESC`,
        [taskId],
      )
    } else {
      // If employee, only get their own requests
      requests = await query(
        `SELECT tcr.*, u.username as requester_name, 
                r.username as reviewer_name
         FROM task_completion_requests tcr
         LEFT JOIN users u ON tcr.user_uuid = u.uuid
         LEFT JOIN users r ON tcr.reviewer_uuid = r.uuid
         WHERE tcr.task_uuid = ? AND tcr.user_uuid = ?
         ORDER BY tcr.created_At DESC`,
        [taskId, userUuid],
      )
    }

    return res.status(200).json({
      success: true,
      data: requests,
      message: "Completion requests fetched successfully",
    })
  } catch (error) {
    console.error("Error in getTaskCompletionRequests:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching completion requests",
    })
  }
}

// Get all pending completion requests (for managers)
const getPendingCompletionRequests = async (req, res) => {
  const userRole = req.user.role

  try {
    // Only managers can view all pending requests
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only managers can view all pending requests",
      })
    }

    const requests = await query(
      `SELECT tcr.*, t.task_name, t.uuid as task_uuid, u.username as requester_name
       FROM task_completion_requests tcr
       JOIN task t ON tcr.task_uuid = t.uuid
       JOIN users u ON tcr.user_uuid = u.uuid
       WHERE tcr.status = 'pending'
       ORDER BY tcr.created_At DESC`,
    )

    return res.status(200).json({
      success: true,
      data: requests,
      message: "Pending completion requests fetched successfully",
    })
  } catch (error) {
    console.error("Error in getPendingCompletionRequests:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching pending requests",
    })
  }
}

module.exports = {
  requestTaskCompletion,
  reviewTaskCompletion,
  getTaskCompletionRequests,
  getPendingCompletionRequests,
}
