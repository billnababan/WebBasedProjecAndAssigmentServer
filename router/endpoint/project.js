const express = require("express");
const { authenticationToken } = require("../../middleware/auth");
const { addProject, getProjects, getProjectById, updateProject, deleteProject, setStatusProject } = require("../../controller/projectManage");

const projectRouter = express();

projectRouter.post("/project", authenticationToken, addProject);
projectRouter.get("/project", authenticationToken, getProjects);
projectRouter.get("/project/:id", authenticationToken, getProjectById);
projectRouter.put("/project/:id", authenticationToken, updateProject);
projectRouter.delete("/project/:id", authenticationToken, deleteProject);
projectRouter.patch("/project/:id/status", authenticationToken, setStatusProject);

module.exports = {
  projectRouter,
};
