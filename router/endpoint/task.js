const express = require("express")
const taskRouter = express.Router()
const taskController = require("../../controller/taskManage")
const taskCompletionController = require("../../controller/completion")
const { authenticationToken } = require("../../middleware/auth")
const upload = require("../../middleware/multer")

// Task routes
taskRouter.get("/task", authenticationToken, taskController.getTask)
taskRouter.get("/task/:id", authenticationToken, taskController.getTaskById)
taskRouter.post("/task", authenticationToken, upload.single("photo"), taskController.addTask)
taskRouter.put("/task/:id", authenticationToken, upload.single("photo"), taskController.updateTask)
taskRouter.delete("/task/:id", authenticationToken, taskController.deleteTask)
taskRouter.patch("/task/:id/status", authenticationToken, taskController.setStatusTask)
// taskRouter.get("/project/:projectId/tasks", authenticationToken, taskController.getTasksByProject)

// Task completion routes
taskRouter.post(
  "/task/:id/completion",
  authenticationToken,
  upload.array("attachments", 5),
  taskCompletionController.requestTaskCompletion,
)
taskRouter.patch("/task/completion/:id", authenticationToken, taskCompletionController.reviewTaskCompletion)
taskRouter.get(
  "/task/:taskId/completion-requests",
  authenticationToken,
  taskCompletionController.getTaskCompletionRequests,
)
taskRouter.get(
  "/task/completion-requests/pending",
  authenticationToken,
  taskCompletionController.getPendingCompletionRequests,
)

module.exports = taskRouter
