const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")
const path = require("path")
const fs = require("fs")
const { fileDir } = require("../utils/file_handler.cjs")

// Add a progress update
const addProgressUpdate = async (req, res) => {
  const { task_uuid, content } = req.body
  const userUuid = req.user.uuid
  const files = req.files

  try {
    // Validate required fields
    if (!task_uuid || !content) {
      return res.status(400).json({ error: "Task ID and content are required" })
    }

    // Check if task exists and belongs to the user
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND user_uuid = ?`, [task_uuid, userUuid])

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found or not assigned to you" })
    }

    // Create progress update
    const progressUuid = uuidv4()
    const now = new Date()

    // Process files if any
    const fileAttachments = []
    if (files && files.length > 0) {
      // Create directory if it doesn't exist
      const dir = fileDir()
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Save each file
      for (const file of files) {
        const fileExt = path.extname(file.originalname)
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`
        const filePath = path.join(dir, fileName)

        // Write file to disk
        fs.writeFileSync(filePath, file.buffer)

        // Add to attachments
        fileAttachments.push({
          uuid: uuidv4(),
          progress_uuid: progressUuid,
          file_name: fileName,
          file_path: filePath,
          file_type: file.mimetype,
          created_At: now,
        })
      }
    }

    // Insert progress update
    await query(
      `INSERT INTO progress (uuid, task_uuid, user_uuid, content, created_At)
       VALUES (?, ?, ?, ?, ?)`,
      [progressUuid, task_uuid, userUuid, content, now],
    )

    // Insert file attachments if any
    if (fileAttachments.length > 0) {
      for (const attachment of fileAttachments) {
        await query(
          `INSERT INTO progress_attachments (uuid, progress_uuid, file_name, file_path, file_type, created_At)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            attachment.uuid,
            attachment.progress_uuid,
            attachment.file_name,
            attachment.file_path,
            attachment.file_type,
            attachment.created_At,
          ],
        )
      }
    }

    // Also add as a comment for the discussion thread
    const commentUuid = uuidv4()
    await query(
      `INSERT INTO comments (uuid, task_uuid, user_uuid, content, created_At)
       VALUES (?, ?, ?, ?, ?)`,
      [commentUuid, task_uuid, userUuid, `Progress Update: ${content}`, now],
    )

    return res.status(201).json({
      success: true,
      message: "Progress update added successfully",
      progressId: progressUuid,
    })
  } catch (error) {
    console.error("Error adding progress update:", error)
    return res.status(500).json({ error: error.message })
  }
}

// Get progress updates for a task
const getProgressUpdates = async (req, res) => {
  const { taskId } = req.params
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    let progress

    // If user is manager or admin, they can see all progress updates
    if (userRole === "manager" || userRole === "admin") {
      progress = await query(
        `SELECT p.*, u.username, u.role
         FROM progress p
         JOIN users u ON p.user_uuid = u.uuid
         WHERE p.task_uuid = ?
         ORDER BY p.created_At DESC`,
        [taskId],
      )
    } else {
      // Regular users can only see progress for tasks assigned to them
      progress = await query(
        `SELECT p.*, u.username, u.role
         FROM progress p
         JOIN users u ON p.user_uuid = u.uuid
         JOIN task t ON p.task_uuid = t.uuid
         WHERE p.task_uuid = ? AND t.user_uuid = ?
         ORDER BY p.created_At DESC`,
        [taskId, userUuid],
      )
    }

    // Get attachments for each progress update
    for (const update of progress) {
      const attachments = await query(`SELECT * FROM progress_attachments WHERE progress_uuid = ?`, [update.uuid])

      // Format file paths to URLs
      update.attachments = attachments.map((attachment) => ({
        ...attachment,
        file_url: `/files/${path.basename(attachment.file_path)}`,
      }))
    }

    return res.status(200).json({
      success: true,
      data: progress,
    })
  } catch (error) {
    console.error("Error fetching progress updates:", error)
    return res.status(500).json({ error: error.message })
  }
}

module.exports = {
  addProgressUpdate,
  getProgressUpdates,
}
