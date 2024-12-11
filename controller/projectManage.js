const { query } = require("../utils/query");
const { v4: uuidv4 } = require("uuid");

const addProject = async (req, res) => {
  const { projectName, description, startDate, dueDate, status } = req.body;

  try {
    // Validasi input
    if (!projectName || !description || !startDate || !dueDate || !status) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validasi status
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'In Progress' or 'Completed'." });
    }

    const projectUuid = uuidv4(); // UUID untuk proyek baru
    const userUuid = req.user.uuid; // UUID pengguna dari token (middleware authenticationToken)

    // Simpan proyek ke database
    await query(
      `INSERT INTO project (uuid, user_uuid, project_name, description, start_date, due_date, status, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectUuid, // uuid untuk proyek
        userUuid, // uuid pengguna yang membuat proyek
        projectName,
        description,
        startDate,
        dueDate,
        status,
        new Date(),
        null,
      ]
    );

    return res.status(201).json({ message: "Project added successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Ambil semua proyek milik pengguna
const getProjects = async (req, res) => {
  const userUuid = req.user.uuid;

  try {
    const projects = await query(`SELECT * FROM project WHERE user_uuid = ?`, [userUuid]);
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Ambil proyek berdasarkan ID
const getProjectById = async (req, res) => {
  const userUuid = req.user.uuid;
  const { id } = req.params;

  try {
    const project = await query(`SELECT * FROM project WHERE uuid = ? AND user_uuid = ?`, [id, userUuid]);

    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found or not accessible by the current user" });
    }

    res.status(200).json(project[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Perbarui proyek berdasarkan ID
const updateProject = async (req, res) => {
  const userUuid = req.user.uuid;
  const { id } = req.params;
  const { projectName, description, startDate, dueDate, status } = req.body;

  try {
    if (!projectName || !description || !startDate || !dueDate || !status) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'In Progress' or 'Completed'." });
    }

    const project = await query(`SELECT * FROM project WHERE uuid = ? AND user_uuid = ?`, [id, userUuid]);

    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found or not accessible by the current user" });
    }

    await query(`UPDATE project SET project_name = ?, description = ?, start_date = ?, due_date = ?, status = ?, updated_At = ? WHERE uuid = ?`, [projectName, description, startDate, dueDate, status, new Date(), id]);

    res.status(200).json({ message: "Project updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Hapus proyek berdasarkan ID
const deleteProject = async (req, res) => {
  const userUuid = req.user.uuid;
  const { id } = req.params;

  try {
    const project = await query(`SELECT * FROM project WHERE uuid = ? AND user_uuid = ?`, [id, userUuid]);

    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found or not accessible by the current user" });
    }

    await query(`DELETE FROM project WHERE uuid = ?`, [id]);

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setStatusProject = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userRole = req.user.role;

  try {
    if (userRole !== "admin") {
      return res.status(403).json({ error: "You are not authorized to perform this action" });
    }

    // Validasi input
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use 'In Progress' or 'Completed'.",
      });
    }

    // Periksa apakah task dengan UUID ada
    const projectExists = await query(`SELECT * FROM project WHERE uuid = ?`, [id]);
    if (projectExists.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    const completedAt = status === "Completed" ? new Date() : null;

    // Update status task
    await query(`UPDATE project SET status = ?, completed_At = ? WHERE uuid = ?`, [status, completedAt, id]);

    return res.status(200).json({ message: "Project status updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  setStatusProject,
};
