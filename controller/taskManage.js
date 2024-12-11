const { query } = require("../utils/query");
const { v4: uuidv4 } = require("uuid");

const getTask = async (req, res) => {
  const userUuid = req.user.uuid;

  try {
    const tasks = await query(`SELECT uuid, task_name, description, status, due_date FROM task WHERE user_uuid = ?`, [userUuid]);

    return res.status(200).json({
      success: true,
      data: tasks,
      message: "Tasks fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// GET a single task by ID
const getTaskById = async (req, res) => {
  const userUuid = req.user.uuid;
  const { taskId } = req.params;
  if (!taskId) {
    return res.status(400).json({ error: "Task ID is required" });
  }

  try {
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND user_uuid = ?`, [taskId, userUuid]);

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found or not accessible by the current user" });
    }

    return res.status(200).json(task[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const addTask = async (req, res) => {
  const { taskName, description, startDate, dueDate, status, projectId } = req.body;
  const file = req.file;

  try {
    // Pastikan semua input sudah diisi
    if (!taskName || !description || !startDate || !dueDate || !status || !projectId) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validasi status
    if (!["pending", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'pending', 'In Progress', or 'Completed'." });
    }

    // Validasi file
    if (!file) {
      return res.status(400).json({ error: "File upload is required" });
    }

    const filePath = file.path; // Lokasi file
    const userUuid = req.user.uuid; // UUID pengguna dari token (ditambahkan dari middleware authenticationToken)
    const taskUuid = uuidv4(); // UUID untuk task baru
    const projectExists = await query(`SELECT * FROM project WHERE uuid = ? AND user_uuid = ?`, [projectId, userUuid]);

    if (projectExists.length === 0) {
      return res.status(404).json({ error: "Project not found or not accessible by the current user" });
    }

    // Simpan task ke database
    await query(
      `INSERT INTO task (uuid, user_uuid, project_uuid, task_name, description, start_date, due_date, status, file, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskUuid, // uuid untuk task
        userUuid, // uuid pengguna yang login
        projectId, // project_uuid (sementara null)
        taskName,
        description,
        startDate,
        dueDate,
        status,
        filePath,
        new Date(),
        null,
      ]
    );

    return res.status(201).json({ message: "Task added successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateTask = async (req, res) => {
  const userUuid = req.user.uuid;
  const { id: taskId } = req.params;
  const { taskName, description, startDate, dueDate, status } = req.body;
  const file = req.file; // Menangkap file jika ada

  // console.log("Authenticated User UUID:", req.user.uuid); // Menampilkan UUID pengguna yang terautentikasi
  // console.log("Task UUID from URL:", taskId); // Menampilkan Task ID yang dikirimkan

  try {
    // Validasi input
    if (!taskName || !description || !startDate || !dueDate || !status) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validasi status
    if (!["pending", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'pending', 'In Progress', or 'Completed'." });
    }

    // Periksa apakah tugas milik pengguna
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND user_uuid = ?`, [taskId, userUuid]);

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found or not accessible by the current user" });
    }

    let filePath = task[0].file; // Ambil file yang ada (jika tidak ada update file baru)

    // Jika ada file baru yang di-upload
    if (file) {
      filePath = file.path; // Lokasi file baru
    }

    // Perbarui data tugas
    await query(`UPDATE task SET task_name = ?, description = ?, start_date = ?, due_date = ?, status = ?, file = ?, updated_At = ? WHERE uuid = ?`, [
      taskName,
      description,
      startDate,
      dueDate,
      status,
      filePath,
      new Date(),
      taskId,
    ]);

    return res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// DELETE a task
const deleteTask = async (req, res) => {
  const userUuid = req.user.uuid;
  const { id: taskId } = req.params;

  try {
    // Periksa apakah tugas milik pengguna
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND user_uuid = ?`, [taskId, userUuid]);

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found or not accessible by the current user" });
    }

    // Hapus tugas
    await query(`DELETE FROM task WHERE uuid = ?`, [taskId]);

    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const setStatusTask = async (req, res) => {
  const { id } = req.params; // UUID task
  const { status } = req.body; // Status baru dari body request
  const userRole = req.user.role; // Role pengguna dari middleware authenticationToken

  try {
    // Periksa apakah pengguna adalah admin
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
    const taskExists = await query(`SELECT * FROM task WHERE uuid = ?`, [id]);
    if (taskExists.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Tentukan nilai untuk kolom `completed_At`
    const completedAt = status === "Completed" ? new Date() : null;

    // Update status task dan completed_At
    await query(`UPDATE task SET status = ?, completed_At = ?, updated_At = ? WHERE uuid = ?`, [status, completedAt, new Date(), id]);

    return res.status(200).json({ message: "Task status updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  setStatusTask,
};

module.exports = {
  getTask,
  getTaskById,
  addTask,
  updateTask,
  deleteTask,
  setStatusTask,
};
