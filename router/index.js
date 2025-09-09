const express = require("express")
const authRouter = require("./endpoint/auth")
const usersRouter = require("./endpoint/user")
const taskRouter = require("./endpoint/task")
const { projectRouter } = require("./endpoint/project")
const { commentRouter } = require("./endpoint/comment")
const { notificationRouter } = require("./endpoint/notification")
const progressRouter = require("./endpoint/progress")
const Router = express()

const api = "/api/v1"

Router.use(api, authRouter)
Router.use(api, usersRouter)
Router.use(api, taskRouter)
Router.use(api, projectRouter)
Router.use(api, commentRouter)
Router.use(api, notificationRouter)
Router.use(api, progressRouter)

module.exports = Router
