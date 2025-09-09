const express = require("express")
const { register, Login, Logout, getUserRole, getAllUsers, updateUserRole } = require("../../controller/user/auth.js")
const { authenticationToken } = require("../../middleware/auth.js")

const authRouter = express()

authRouter.post("/register", register)
authRouter.post("/login", Login)
authRouter.get("/logout", Logout)
authRouter.get("/user/role", authenticationToken, getUserRole)
authRouter.get("/users", authenticationToken, getAllUsers)
authRouter.put("/users/:uuid/role", authenticationToken, updateUserRole) // New route for updating user role

module.exports = authRouter
