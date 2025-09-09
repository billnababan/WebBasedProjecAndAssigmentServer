const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")

const addProject = async (req, res) => {
  const { projectName, description, startDate, dueDate, status, assignedTo } = req.body
  const file = req.file // Get the file from multer

  try {
    // Cek role pengguna - hanya admin yang bisa create project
    if (req.user.role !== "admin" && req.user.role !== "manager") {
      return res.status(403).json({ error: "Access denied. Only admins can add projects." })
    }

    // Validasi input
    if (!projectName || !description || !startDate || !dueDate || !status || !assignedTo) {
      return res.status(400).json({ error: "All fields are required" })
    }
    
    // Validasi status
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'In Progress' or 'Completed'." })
    }

    // Cek apakah assignedTo adalah user dengan role employee
    const cekUser = await query("SELECT role FROM users WHERE uuid = ? AND is_deleted = 0", [assignedTo])
    if (cekUser.length === 0 || cekUser[0].role !== "employee") {
      return res.status(400).json({ error: "Assigned user must be an active employee" })
    }

    const projectUuid = uuidv4()
    const adminUuid = req.user.uuid
    const filePath = file ? file.path : null

    // Simpan proyek dengan file
    await query(
      `INSERT INTO project (uuid, user_uuid, project_name, description, start_date, due_date, status, file, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectUuid, adminUuid, projectName, description, startDate, dueDate, status, filePath, new Date(), null],
    )

    // Tambah ke tabel relasi project -> employee
    await query(`INSERT INTO project_users (uuid, project_id, user_id) VALUES (?, ?, ?)`, [
      uuidv4(),
      projectUuid,
      assignedTo,
    ])

    return res.status(201).json({ 
      message: "Project created and assigned to employee successfully.",
      projectId: projectUuid
    })
  } catch (error) {
    console.error("Error in addProject:", error)
    return res.status(500).json({ error: "Internal server error." })
  }
}

// Ambil semua proyek dengan role-based filtering
const getProjects = async (req, res) => {
  try {
    const { role, uuid } = req.user
    let projects

    
    if (role === "admin" || role === "manager") {
      // Admin bisa lihat semua project
      projects = await query(`
        SELECT 
          p.*, 
          u.username AS owner_name,
          GROUP_CONCAT(DISTINCT CONCAT(assigned_users.uuid, ':', assigned_users.username)) AS assigned_users_info
        FROM project p
        LEFT JOIN users u ON p.user_uuid = u.uuid
        LEFT JOIN project_users pu ON p.uuid = pu.project_id
        LEFT JOIN users assigned_users ON pu.user_id = assigned_users.uuid AND assigned_users.is_deleted = 0
        GROUP BY p.uuid
        ORDER BY p.created_At DESC
      `)
    } else if (role === "employee") {
      // Employee hanya bisa lihat project yang di-assign ke mereka
      projects = await query(`
        SELECT 
          p.*, 
          u.username AS owner_name,
          GROUP_CONCAT(DISTINCT CONCAT(assigned_users.uuid, ':', assigned_users.username)) AS assigned_users_info
        FROM project p
        LEFT JOIN users u ON p.user_uuid = u.uuid
        INNER JOIN project_users pu ON p.uuid = pu.project_id
        LEFT JOIN users assigned_users ON pu.user_id = assigned_users.uuid AND assigned_users.is_deleted = 0
        WHERE pu.user_id = ?
        GROUP BY p.uuid
        ORDER BY p.created_At DESC
      `, [uuid])
    } else {
      // Role lain tidak bisa akses project
      return res.status(403).json({ error: "Access denied. Insufficient permissions." })
    }

    // Format assigned users info
    const formattedProjects = projects.map(project => ({
      ...project,
      assigned_users: project.assigned_users_info 
        ? project.assigned_users_info.split(',').map(info => {
            const [uuid, username] = info.split(':')
            return { uuid, username }
          })
        : []
    }))

    res.status(200).json(formattedProjects)
  } catch (error) {
    console.error("Error fetching projects:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

// Ambil proyek berdasarkan ID dengan role-based access
const getProjectById = async (req, res) => {
  try {
    const { id } = req.params
    const { role, uuid } = req.user

    // Cek apakah project exists
    const project = await query(
      `SELECT p.*, u.username as owner_name 
       FROM project p
       LEFT JOIN users u ON p.user_uuid = u.uuid
       WHERE p.uuid = ?`,
      [id],
    )

    if (project.length === 0) {
      return res.status(404).json({ message: "Project not found" })
    }

    // Role-based access control
    if (role === "employee") {
      // Cek apakah employee di-assign ke project ini
      const isAssigned = await query(
        `SELECT * FROM project_users WHERE project_id = ? AND user_id = ?`,
        [id, uuid]
      )
      if (isAssigned.length === 0) {
        return res.status(403).json({ error: "Access denied. You are not assigned to this project." })
      }
    } else if (role !== "admin") {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." })
    }

    // Get tasks for this project
    const tasks = await query(`SELECT * FROM task WHERE project_uuid = ? ORDER BY created_At DESC`, [id])

    // Get assigned users
    const assignedUsers = await query(
      `SELECT u.uuid, u.username, u.email FROM project_users pu
       LEFT JOIN users u ON pu.user_id = u.uuid
       WHERE pu.project_id = ? AND u.is_deleted = 0`,
      [id],
    )

    res.status(200).json({
      project: project[0],
      tasks,
      assignedUsers,
    })
  } catch (error) {
    console.error("Error fetching project by id:", error.message)
    res.status(500).json({ message: "Server error" })
  }
}

// Update project - hanya admin
const updateProject = async (req, res) => {
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const { id } = req.params
  let {
    projectName,
    description,
    startDate,
    dueDate,
    status,
    assignedUsers,
  } = req.body
  const file = req.file

  try {
    // Validasi input dasar
    if (!projectName || !description || !startDate || !dueDate || !status) {
      return res.status(400).json({ error: "All fields are required" })
    }

    // Validasi status
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'In Progress' or 'Completed'." })
    }

    // Hanya admin yang bisa update project
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can update projects" })
    }

    // Cek apakah project ada
    const project = await query(`SELECT * FROM project WHERE uuid = ?`, [id])
    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found" })
    }

    // Handle file upload
    let filePath = project[0].file
    if (file) {
      filePath = file.path
    }

    // Update data project
    await query(
      `UPDATE project 
       SET project_name = ?, description = ?, start_date = ?, due_date = ?, status = ?, file = ?, updated_At = ? 
       WHERE uuid = ?`,
      [projectName, description, startDate, dueDate, status, filePath, new Date(), id]
    )

    // Parse assignedUsers jika dikirim dalam bentuk string dari FormData
    let parsedAssignedUsers = assignedUsers
    if (typeof assignedUsers === "string") {
      try {
        parsedAssignedUsers = JSON.parse(assignedUsers)
      } catch (err) {
        return res.status(400).json({ error: "Invalid assigned users format" })
      }
    }

    // Update assigned users jika ada
    if (
      parsedAssignedUsers &&
      Array.isArray(parsedAssignedUsers) &&
      parsedAssignedUsers.length > 0
    ) {
      // Validasi bahwa semua user adalah employee dan aktif
      const userRoles = await query(
        `SELECT uuid, role FROM users WHERE uuid IN (${parsedAssignedUsers.map(() => "?").join(",")}) AND is_deleted = 0`,
        parsedAssignedUsers
      )

      if (userRoles.length !== parsedAssignedUsers.length) {
        return res.status(400).json({ error: "One or more assigned users do not exist or are inactive" })
      }

      const nonEmployees = userRoles.filter((user) => user.role !== "employee")
      if (nonEmployees.length > 0) {
        return res.status(400).json({ error: "Only employees can be assigned to projects" })
      }

      // Hapus assignment lama
      await query(`DELETE FROM project_users WHERE project_id = ?`, [id])

      // Tambahkan assignment baru
      for (const userId of parsedAssignedUsers) {
        await query(`INSERT INTO project_users (uuid, project_id, user_id) VALUES (?, ?, ?)`, [
          uuidv4(),
          id,
          userId,
        ])
      }
    }

    res.status(200).json({ message: "Project updated successfully" })
  } catch (error) {
    console.error("Error updating project:", error)
    res.status(500).json({ error: error.message || "Internal server error" })
  }
}


// Delete project - hanya admin
const deleteProject = async (req, res) => {
  const userRole = req.user.role
  const { id } = req.params

  try {
    // Hanya admin yang bisa delete project
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can delete projects" })
    }

    // Cek apakah project exists
    const project = await query(`SELECT * FROM project WHERE uuid = ?`, [id])
    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found" })
    }

    // Delete dalam urutan yang benar untuk menghindari foreign key constraint
    await query(`DELETE FROM task WHERE project_uuid = ?`, [id])
    await query(`DELETE FROM project_users WHERE project_id = ?`, [id])
    await query(`DELETE FROM project WHERE uuid = ?`, [id])

    res.status(200).json({ message: "Project and all related data deleted successfully" })
  } catch (error) {
    console.error("Error deleting project:", error)
    res.status(500).json({ error: error.message })
  }
}

// Set status project - hanya admin
const setStatusProject = async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const userRole = req.user.role

  try {
    // Hanya admin yang bisa change status
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can change project status" })
    }

    // Validasi status
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use 'In Progress' or 'Completed'.",
      })
    }

    // Cek apakah project exists
    const projectExists = await query(`SELECT * FROM project WHERE uuid = ?`, [id])
    if (projectExists.length === 0) {
      return res.status(404).json({ error: "Project not found" })
    }

    const completedAt = status === "Completed" ? new Date() : null

    // Update status
    await query(`UPDATE project SET status = ?, completed_At = ?, updated_At = ? WHERE uuid = ?`, [status, completedAt, new Date(), id])

    return res.status(200).json({ message: "Project status updated successfully" })
  } catch (error) {
    console.error("Error updating project status:", error)
    return res.status(500).json({ error: error.message })
  }
}

module.exports = {
  addProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  setStatusProject,
}
