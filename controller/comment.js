const { query } = require("../utils/query");
const { v4: uuidv4 } = require("uuid");

const addComment = async (req, res) => {
  const { task_uuid, content } = req.body;
  const user_uuid = req.user.uuid; // UUID pengguna dari token

  try {
    // Validasi input
    if (!task_uuid || !content) {
      return res.status(400).json({ error: "Task UUID and content are required" });
    }

    // Periksa apakah task ada
    const taskExists = await query(`SELECT uuid FROM task WHERE uuid = ?`, [task_uuid]);
    if (taskExists.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const commentUuid = uuidv4(); // Generate UUID untuk komentar baru

    // Simpan komentar ke database
    await query(
      `INSERT INTO comment (uuid, task_uuid, user_uuid, content, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [commentUuid, task_uuid, user_uuid, content, new Date(), new Date()]
    );

    return res.status(201).json({ message: "Comment added successfully", commentUuid });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getComments = async (req, res) => {
  try {
    const comments = await query(`SELECT * FROM comment ORDER BY created_At DESC`);
    return res.status(200).json(comments);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getCommentById = async (req, res) => {
  const { id } = req.params;

  try {
    const comment = await query(`SELECT * FROM comment WHERE uuid = ?`, [id]);
    if (comment.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }
    return res.status(200).json(comment[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateComment = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const commentExists = await query(`SELECT * FROM comment WHERE uuid = ?`, [id]);
    if (commentExists.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await query(`UPDATE comment SET content = ?, updated_At = ? WHERE uuid = ?`, [content, new Date(), id]);

    return res.status(200).json({ message: "Comment updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteComment = async (req, res) => {
  const { id } = req.params;

  try {
    const commentExists = await query(`SELECT * FROM comment WHERE uuid = ?`, [id]);
    if (commentExists.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await query(`DELETE FROM comment WHERE uuid = ?`, [id]);

    return res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
};
