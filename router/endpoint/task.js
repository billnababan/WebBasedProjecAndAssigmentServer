const express = require("express");
const { authenticationToken } = require("../../middleware/auth");
const multer = require("../../middleware/multer");
const { addTask, getTask, getTaskById, updateTask, deleteTask, setStatusTask } = require("../../controller/taskManage");

const tasksRouter = express();

tasksRouter.get("/task", authenticationToken, getTask);
tasksRouter.get("/task/:id", authenticationToken, getTaskById);
tasksRouter.post("/task", authenticationToken, multer, addTask);
tasksRouter.put("/task/:id", authenticationToken, multer, updateTask);
tasksRouter.delete("/task/:id", authenticationToken, deleteTask);
tasksRouter.patch("/task/:id/status", authenticationToken, setStatusTask);

module.exports = {
  tasksRouter,
};
