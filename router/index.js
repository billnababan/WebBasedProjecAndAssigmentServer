const express = require("express");
const authRouter = require("./endpoint/auth");
const usersRouter = require("./endpoint/user");
const { tasksRouter } = require("./endpoint/task");
const { projectRouter } = require("./endpoint/project");
const { commentRouter } = require("./endpoint/comment");

const Router = express();

const api = "/api/v1";

Router.use(api, authRouter);
Router.use(api, usersRouter);
Router.use(api, tasksRouter);
Router.use(api, projectRouter);
Router.use(api, commentRouter);

module.exports = Router;
