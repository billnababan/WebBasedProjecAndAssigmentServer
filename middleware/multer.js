const multer = require("multer")
const path = require("path")
const fs = require("fs")
const { fileDir } = require("../utils/file_handler.cjs")

// Ensure upload directory exists
const uploadDir = fileDir()
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now().toString()
    const ext = path.extname(file.originalname)
    cb(null, `${uniqueSuffix}${ext}`)
  },
})

// File filter function
const fileFilter = (req, file, cb) => {
  // Accept images and documents
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only images and documents are allowed."), false)
  }
}

// File size limits
const limits = {
  fileSize: 7 * 1024 * 1024, // 7MB max file size
}

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits,
})

// Export multer instance
module.exports = upload
