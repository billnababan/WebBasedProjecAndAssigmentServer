const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")
const { getIO } = require("../websocket/socketHandler")

const addComment = async (req, res) => {
  const { task_uuid, content } = req.body
  const user_uuid = req.user.uuid // UUID pengguna dari token

  try {
    // Validasi input
    if (!task_uuid || !content) {
      return res.status(400).json({ error: "Task UUID and content are required" })
    }

    // Periksa apakah task ada
    const taskExists = await query(`SELECT uuid FROM task WHERE uuid = ?`, [task_uuid])
    if (taskExists.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    const commentUuid = uuidv4() // Generate UUID untuk komentar baru

    // Simpan komentar ke database
    await query(
      `INSERT INTO comment (uuid, task_uuid, user_uuid, content, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [commentUuid, task_uuid, user_uuid, content, new Date(), new Date()],
    )

    // Ambil data komentar yang baru dibuat termasuk informasi user
    const newComment = await query(
      `SELECT c.*, u.username, u.role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.uuid = ?`,
      [commentUuid],
    )

    try {
      const io = getIO()
      io.to(`task-${task_uuid}`).emit("new-comment", {
        comment: newComment[0],
        taskId: task_uuid,
      })
    } catch (socketError) {
      console.error("Socket emission error:", socketError)
      // Continue with response even if socket fails
    }

    return res.status(201).json({
      message: "Comment added successfully",
      commentUuid,
      comment: newComment[0],
    })
  } catch (error) {
    console.error("Error adding comment:", error)
    return res.status(500).json({ error: error.message })
  }
}

const getComments = async (req, res) => {
  try {
    // Join dengan tabel users untuk mendapatkan username dan role
    const comments = await query(
      `SELECT c.*, u.username, u.role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       ORDER BY c.created_At DESC`,
    )
    return res.status(200).json(comments)
  } catch (error) {
    console.error("Error getting comments:", error)
    return res.status(500).json({ error: error.message })
  }
}

const getCommentsByTaskId = async (req, res) => {
  const { taskId } = req.params

  try {
    // Join dengan tabel users untuk mendapatkan username dan role
    const comments = await query(
      `SELECT c.*, u.username, u.role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.task_uuid = ?
       ORDER BY c.created_At DESC`,
      [taskId],
    )
    return res.status(200).json(comments)
  } catch (error) {
    console.error("Error getting comments by task ID:", error)
    return res.status(500).json({ error: error.message })
  }
}

const getCommentById = async (req, res) => {
  const { id } = req.params

  try {
    // Join dengan tabel users untuk mendapatkan username dan role
    const comment = await query(
      `SELECT c.*, u.username, u.role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.uuid = ?`,
      [id],
    )

    if (comment.length === 0) {
      return res.status(404).json({ error: "Comment not found" })
    }

    return res.status(200).json(comment[0])
  } catch (error) {
    console.error("Error getting comment by ID:", error)
    return res.status(500).json({ error: error.message })
  }
}

const updateComment = async (req, res) => {
  const { id } = req.params
  const { content } = req.body
  const user_uuid = req.user.uuid

  try {
    if (!content) {
      return res.status(400).json({ error: "Content is required" })
    }

    // Periksa apakah komentar ada dan apakah pengguna adalah pemilik komentar atau admin/manager
    const commentCheck = await query(
      `SELECT c.*, u.role as user_role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.uuid = ?`,
      [id],
    )

    if (commentCheck.length === 0) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const comment = commentCheck[0]
    const currentUserRole = req.user.role

    // Hanya pemilik komentar, admin, atau manager yang dapat mengedit komentar
    if (comment.user_uuid !== user_uuid && currentUserRole !== "admin" && currentUserRole !== "manager") {
      return res.status(403).json({ error: "You don't have permission to update this comment" })
    }

    await query(`UPDATE comment SET content = ?, updated_At = ? WHERE uuid = ?`, [content, new Date(), id])

    // Ambil data komentar yang diperbarui termasuk informasi user
    const updatedComment = await query(
      `SELECT c.*, u.username, u.role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.uuid = ?`,
      [id],
    )

    try {
      const io = getIO()
      io.to(`task-${comment.task_uuid}`).emit("comment-updated", {
        comment: updatedComment[0],
        taskId: comment.task_uuid,
      })
    } catch (socketError) {
      console.error("Socket emission error:", socketError)
    }

    return res.status(200).json({
      message: "Comment updated successfully",
      comment: updatedComment[0],
    })
  } catch (error) {
    console.error("Error updating comment:", error)
    return res.status(500).json({ error: error.message })
  }
}

const deleteComment = async (req, res) => {
  const { id } = req.params
  const user_uuid = req.user.uuid

  try {
    // Periksa apakah komentar ada dan apakah pengguna adalah pemilik komentar atau admin/manager
    const commentCheck = await query(
      `SELECT c.*, u.role as user_role 
       FROM comment c
       JOIN users u ON c.user_uuid = u.uuid
       WHERE c.uuid = ?`,
      [id],
    )

    if (commentCheck.length === 0) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const comment = commentCheck[0]
    const currentUserRole = req.user.role

    // Hanya pemilik komentar, admin, atau manager yang dapat menghapus komentar
    if (comment.user_uuid !== user_uuid && currentUserRole !== "admin" && currentUserRole !== "manager") {
      return res.status(403).json({ error: "You don't have permission to delete this comment" })
    }

    await query(`DELETE FROM comment WHERE uuid = ?`, [id])

    try {
      const io = getIO()
      io.to(`task-${comment.task_uuid}`).emit("comment-deleted", {
        commentId: id,
        taskId: comment.task_uuid,
      })
    } catch (socketError) {
      console.error("Socket emission error:", socketError)
    }

    return res.status(200).json({ message: "Comment deleted successfully" })
  } catch (error) {
    console.error("Error deleting comment:", error)
    return res.status(500).json({ error: error.message })
  }
}

module.exports = {
  addComment,
  getComments,
  getCommentsByTaskId,
  getCommentById,
  updateComment,
  deleteComment,
}
