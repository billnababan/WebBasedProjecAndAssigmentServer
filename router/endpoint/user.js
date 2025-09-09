const express = require("express")
const { authenticationToken } = require("../../middleware/auth.js")
const { updatePassword, updateProfile, getProfile, DeleteUser, serveFile, requestPasswordReset, resetPassword } = require("../../controller/user/user.js")
const uploadMiddleware = require("../../middleware/multer.js")

const usersRouter = express.Router()

// Profile routes
usersRouter.get("/users/:id/profile", authenticationToken, getProfile)
usersRouter.put("/users/:id/profile", authenticationToken, uploadMiddleware.single("photo"), updateProfile)

// Password routes
usersRouter.patch("/users/password", authenticationToken, updatePassword)
usersRouter.post("/forgot-password", requestPasswordReset);
usersRouter.post("/reset-password", resetPassword);

// User management routes
usersRouter.delete("/users/:uuid", authenticationToken, DeleteUser)

// File serving route - no authentication required for public access
usersRouter.get("/files/:filename", serveFile)

module.exports = usersRouter
