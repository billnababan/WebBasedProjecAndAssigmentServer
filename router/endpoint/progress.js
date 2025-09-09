const express = require("express")
const router = express.Router()
const { addProgressUpdate, getProgressUpdates } = require("../../controller/progress")
const { authenticationToken } = require("../../middleware/auth")
const multer = require("multer")

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// Add progress update with file uploads
router.post("/", authenticationToken, upload.array("files", 5), addProgressUpdate)

// Get progress updates for a task
router.get("/task/:taskId", authenticationToken, getProgressUpdates)

module.exports = router
