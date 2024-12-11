const express = require("express");
const { authenticationToken } = require("../../middleware/auth.js");
const { updatePassword, DeleteUser } = require("../../controller/user/user.js");

const usersRouter = express();

usersRouter.patch("/users/:uuid", authenticationToken, updatePassword);
usersRouter.delete("/users/:uuid", DeleteUser);

module.exports = usersRouter;
