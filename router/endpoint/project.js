const express = require("express")
const projectRouter = express.Router()
const { authenticationToken } = require("../../middleware/auth")
const { 
  addProject, 
  getProjects, 
  getProjectById, 
  updateProject, 
  deleteProject, 
  setStatusProject 
} = require("../../controller/projectManage")
const upload = require("../../middleware/multer")

const projectCompletionController = require("../../controller/projectCompletion")

// Project routes with file upload middleware
projectRouter.post("/project", authenticationToken, upload.single("file"), addProject)
projectRouter.get("/project", authenticationToken, getProjects)
projectRouter.get("/project/:id", authenticationToken, getProjectById)
projectRouter.put("/project/:id", authenticationToken, upload.single("file"), updateProject)
projectRouter.delete("/project/:id", authenticationToken, deleteProject)
projectRouter.patch("/project/:id/status", authenticationToken, setStatusProject)

// Task completion routes
projectRouter.post(
  "/project/:id/completion",
  authenticationToken,
  upload.array("attachments", 5),
  projectCompletionController.requestProjectCompletion,
)
projectRouter.patch("/project/completion/:id", authenticationToken, projectCompletionController.reviewProjectCompletion)
projectRouter.get(
  "/project/:projectId/completion-requests",
  authenticationToken,
  projectCompletionController.getProjectCompletionRequests,
)
projectRouter.get(
  "/project/completion-requests/pending",
  authenticationToken,
  projectCompletionController.getPendingProjectCompletionRequests,
)

module.exports = {
  projectRouter,
}
