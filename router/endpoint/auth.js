const express = require("express");
const { register, Login, Logout, getUserRole } = require("../../controller/user/auth.js");
const { authenticationToken } = require("../../middleware/auth.js");

const authRouter = express();

authRouter.post("/register", authenticationToken, register);
authRouter.post("/login", Login);
authRouter.get("/logout", Logout);
authRouter.get("/user/role", authenticationToken, getUserRole);

module.exports = authRouter;
