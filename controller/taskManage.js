const { query } = require("../utils/query")
const { v4: uuidv4 } = require("uuid")
const { getTaskDisplayStatus } = require("../utils/task-status-helper")

const getTask = async (req, res) => {
  const userUuid = req.user.uuid
  const userRole = req.user.role

  try {
    let tasks

    // If user is manager or admin, get all tasks with additional info
    if (userRole === "manager" || userRole === "admin") {
      tasks = await query(`
        SELECT t.*, 
               p.project_name,
               u.username as assigned_to
        FROM task t
        LEFT JOIN project p ON t.project_uuid = p.uuid
        LEFT JOIN users u ON t.user_uuid = u.uuid
        ORDER BY t.created_At DESC
      `)
    } else {
      // If regular user (employee), get tasks assigned to them
      tasks = await query(
        `
        SELECT t.*, 
               p.project_name,
               u.username as assigned_to
        FROM task t
        LEFT JOIN project p ON t.project_uuid = p.uuid
        LEFT JOIN users u ON t.user_uuid = u.uuid
        WHERE t.user_uuid = ? 
        ORDER BY t.created_At DESC
      `,
        [userUuid, userUuid],
      )
    }

    // Add display status to each task
    const tasksWithDisplayStatus = await Promise.all(
      tasks.map(async (task) => {
        const displayStatus = await getTaskDisplayStatus(task.uuid, query)
        return {
          ...task,
          status: displayStatus || task.status,
        }
      }),
    )

    return res.status(200).json({
      success: true,
      data: tasksWithDisplayStatus,
      message: "Tasks fetched successfully",
    })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

// GET a single task by ID
const getTaskById = async (req, res) => {
  const { id } = req.params
  const { role, uuid } = req.user

  try {
    // Get task with project and assignee information
    let taskResult

    if (role === "manager" || role === "admin") {
      // Managers can see any task
      taskResult = await query(
        `SELECT t.*, 
                p.project_name, 
                u.username as assigned_to
         FROM task t
         LEFT JOIN project p ON t.project_uuid = p.uuid
         LEFT JOIN users u ON t.user_uuid = u.uuid
         WHERE t.uuid = ?`,
        [id],
      )
    } else {
      // Employees can only see their own tasks
      taskResult = await query(
        `SELECT t.*, 
                p.project_name, 
                u.username as assigned_to
         FROM task t
         LEFT JOIN project p ON t.project_uuid = p.uuid
         LEFT JOIN users u ON t.user_uuid = u.uuid
         WHERE t.uuid = ? AND (t.user_uuid = ? )`,
        [id, uuid, uuid],
      )
    }

    if (taskResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Task not found or not accessible",
      })
    }

    // Get the display status (which might be "Pending Review")
    const displayStatus = await getTaskDisplayStatus(id, query)

    // Add the display status to the task object
    const taskWithDisplayStatus = {
      ...taskResult[0],
      status: displayStatus || taskResult[0].status,
    }

    return res.status(200).json({
      success: true,
      data: taskWithDisplayStatus,
    })
  } catch (error) {
    console.error("Error in getTaskById:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "An error occurred while fetching the task",
    })
  }
}

const addTask = async (req, res) => {
  const { taskName, description, startDate, dueDate, status, assignedTo, projectId } = req.body
  const userRole = req.user.role
  const userUuid = req.user.uuid
  const file = req.file // Get the file from multer

  try {
    // Only managers can create tasks
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({ error: "Only managers can create tasks" })
    }

    // Ensure all required inputs are filled
    if (!taskName || !description || !startDate || !dueDate || !status || !projectId) {
      return res.status(400).json({ error: "All fields are required" })
    }

    // Validate status
    if (!["Pending", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use 'Pending', 'In Progress', or 'Completed'." })
    }

    // Validate project exists
    const projectExists = await query(`SELECT * FROM project WHERE uuid = ?`, [projectId])
    if (projectExists.length === 0) {
      return res.status(400).json({ error: "Selected project does not exist" })
    }

    // Determine which user will be assigned
    let assignedUserUuid = userUuid // Default: user creating the task

    // If manager specifies another user to be assigned
    if (assignedTo) {
      const assignedUser = await query(`SELECT uuid, role FROM users WHERE uuid = ?`, [assignedTo])
      if (assignedUser.length > 0) {
        // Only employees can be assigned tasks
        if (assignedUser[0].role !== "employee") {
          return res.status(400).json({ error: "Tasks can only be assigned to employees" })
        }
        assignedUserUuid = assignedTo
      } else {
        return res.status(400).json({ error: "Selected employee does not exist" })
      }
    }

    const taskUuid = uuidv4() // UUID for new task
    const filePath = file ? file.path : null // File path if file exists

    // Save task to database with projectId
    await query(
      `INSERT INTO task (uuid, user_uuid, project_uuid, task_name, description, start_date, due_date, status, file, created_At, updated_At)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskUuid,
        assignedUserUuid,
        projectId, // Add projectId to the query
        taskName,
        description,
        startDate,
        dueDate,
        status,
        filePath,
        new Date(),
        new Date(),
      ],
    )

    // Get project name for response
    const projectName = projectExists[0].project_name || "Unknown Project"

    return res.status(201).json({
      success: true,
      message: `Task added successfully to project "${projectName}"`,
      taskId: taskUuid,
      projectName: projectName,
    })
  } catch (error) {
    console.error("Error creating task:", error)
    return res.status(500).json({ error: error.message })
  }
}

const updateTask = async (req, res) => {
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const { id } = req.params
  const { taskName, description, startDate, dueDate, status, assignedTo, projectId } = req.body
  const file = req.file // Get file from multer if it exists

  try {
    // Only managers can update tasks
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({ error: "Only managers can update tasks" })
    }

    // Validate input
    if (!taskName || !description || !startDate || !dueDate || !status || !projectId) {
      return res.status(400).json({ error: "All fields are required" })
    }

   
    // Check if task exists
    const task = await query(`SELECT * FROM task WHERE uuid = ?`, [id])

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Validate project exists
    const projectExists = await query(`SELECT * FROM project WHERE uuid = ?`, [projectId])
    if (projectExists.length === 0) {
      return res.status(400).json({ error: "Selected project does not exist" })
    }

    let filePath = task[0].file // Get existing file (if no new file is uploaded)

    // If there's a new file uploaded
    if (file) {
      filePath = file.path // New file location
    }

    // Determine which user will be assigned
    let assignedUserUuid = task[0].user_uuid // Default: keep the same user

    // If manager specifies another user to be assigned
    if (assignedTo) {
      // Check if the assigned user is an employee
      const assignedUser = await query(`SELECT uuid FROM users WHERE uuid = ? AND role = 'employee'`, [assignedTo])
      if (assignedUser.length > 0) {
        assignedUserUuid = assignedTo
      } else {
        return res.status(400).json({ error: "Tasks can only be assigned to employees" })
      }
    }

    // Update task data including project_uuid
    await query(
      `
      UPDATE task 
      SET task_name = ?, description = ?, start_date = ?, due_date = ?, 
          status = ?, file = ?, user_uuid = ?, project_uuid = ?, updated_At = ? 
      WHERE uuid = ?`,
      [taskName, description, startDate, dueDate, status, filePath, assignedUserUuid, projectId, new Date(), id],
    )

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
    })
  } catch (error) {
    console.error("Error updating task:", error)
    return res.status(500).json({ error: error.message })
  }
}

// DELETE a task
const deleteTask = async (req, res) => {
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const { id } = req.params

  try {
    // Only managers can delete tasks
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({ error: "Only managers can delete tasks" })
    }

    // Check if task exists
    const task = await query(`SELECT * FROM task WHERE uuid = ?`, [id])

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Delete task
    await query(`DELETE FROM task WHERE uuid = ?`, [id])

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting task:", error)
    return res.status(500).json({ error: error.message })
  }
}

const setStatusTask = async (req, res) => {
  const { id } = req.params // Task UUID
  const { status } = req.body // New status from request body
  const userRole = req.user.role // User role from authenticationToken middleware
  const userUuid = req.user.uuid

  try {
    // Check if user is a manager
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({ error: "You are not authorized to perform this action" })
    }

    // Validate input
    if (!["In Progress", "Completed"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use 'In Progress' or 'Completed'.",
      })
    }

    // Check if task exists
    const task = await query(`SELECT * FROM task WHERE uuid = ?`, [id])

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found" })
    }

    // Determine value for `completed_At` column
    const completedAt = status === "Completed" ? new Date() : null

    // Update task status and completed_At
    await query(`UPDATE task SET status = ?, completed_At = ?, updated_At = ? WHERE uuid = ?`, [
      status,
      completedAt,
      new Date(),
      id,
    ])

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully",
    })
  } catch (error) {
    console.error("Error updating task status:", error)
    return res.status(500).json({ error: error.message })
  }
}

// Get tasks by project ID
const getTasksByProject = async (req, res) => {
  const userUuid = req.user.uuid
  const userRole = req.user.role
  const { projectId } = req.params

  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" })
  }

  try {
    let tasks
    let project

    // Verify project exists
    project = await query(`SELECT * FROM project WHERE uuid = ?`, [projectId])

    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found" })
    }

    // Get tasks for this project based on role
    if (userRole === "manager" || userRole === "admin") {
      // Managers can see all tasks in the project
      tasks = await query(
        `
        SELECT t.*, 
               p.project_name,
               u.username as assigned_to
        FROM task t
        LEFT JOIN project p ON t.project_uuid = p.uuid
        LEFT JOIN users u ON t.user_uuid = u.uuid
        WHERE t.project_uuid = ?
        ORDER BY t.created_At DESC
      `,
        [projectId],
      )
    } else {
      // Employees can only see their own tasks in the project
      tasks = await query(
        `
        SELECT t.*, 
               p.project_name,
               u.username as assigned_to
        FROM task t
        LEFT JOIN project p ON t.project_uuid = p.uuid
        LEFT JOIN users u ON t.user_uuid = u.uuid
        WHERE t.project_uuid = ? AND (t.user_uuid = ? )
        ORDER BY t.created_At DESC
      `,
        [projectId, userUuid, userUuid],
      )
    }

    // Add display status to each task
    const tasksWithDisplayStatus = await Promise.all(
      tasks.map(async (task) => {
        const displayStatus = await getTaskDisplayStatus(task.uuid, query)
        return {
          ...task,
          status: displayStatus || task.status,
        }
      }),
    )

    return res.status(200).json({
      success: true,
      data: tasksWithDisplayStatus,
      project: project[0],
      message: "Project tasks fetched successfully",
    })
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

// Submit task for review (for employees)
const submitTaskForReview = async (req, res) => {
  const { id } = req.params // Task UUID
  const userRole = req.user.role
  const userUuid = req.user.uuid

  try {
    // Only employees can submit tasks for review
    if (userRole !== "employee") {
      return res.status(403).json({ error: "Only employees can submit tasks for review" })
    }

    // Check if task exists and belongs to the employee
    const task = await query(`SELECT * FROM task WHERE uuid = ? AND (user_uuid = ? OR assignedTo = ?)`, [
      id,
      userUuid,
      userUuid,
    ])

    if (task.length === 0) {
      return res.status(404).json({ error: "Task not found or not assigned to you" })
    }

    // Check if task is already completed or pending review
    if (task[0].status === "Completed") {
      return res.status(400).json({ error: "Task is already completed" })
    }

    if (task[0].status === "Pending Review") {
      return res.status(400).json({ error: "Task is already pending review" })
    }

    // Update task status to "Pending Review"
    await query(`UPDATE task SET status = ?, updated_At = ? WHERE uuid = ?`, ["Pending Review", new Date(), id])

    return res.status(200).json({
      success: true,
      message: "Task submitted for review successfully",
    })
  } catch (error) {
    console.error("Error submitting task for review:", error)
    return res.status(500).json({ error: error.message })
  }
}

// Get tasks pending review (for managers)
const getTasksPendingReview = async (req, res) => {
  const userRole = req.user.role

  try {
    // Only managers can see tasks pending review
    if (userRole !== "manager" && userRole !== "admin") {
      return res.status(403).json({ error: "Only managers can view tasks pending review" })
    }

    // Get all tasks with status "Pending Review"
    const tasks = await query(
      `
      SELECT t.*, 
             p.project_name, 
             u.username as assigned_to
      FROM task t
      LEFT JOIN project p ON t.project_uuid = p.uuid
      LEFT JOIN users u ON t.user_uuid = u.uuid
      WHERE t.status = 'Pending Review'
      ORDER BY t.updated_At DESC
    `,
    )

    return res.status(200).json({
      success: true,
      data: tasks,
      message: "Tasks pending review fetched successfully",
    })
  } catch (error) {
    console.error("Error fetching pending review tasks:", error)
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}

module.exports = {
  getTask,
  getTaskById,
  addTask,
  updateTask,
  deleteTask,
  setStatusTask,
  getTasksByProject,
  submitTaskForReview,
  getTasksPendingReview,
}
