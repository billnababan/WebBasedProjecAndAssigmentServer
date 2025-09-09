// router/endpoint/comment.js
const express = require("express");
const commentRouter = express.Router();
const {authenticationToken} = require("../../middleware/auth");

const { addComment, getComments, getCommentsByTaskId, getCommentById, updateComment, deleteComment } = require("../../controller/comment");

// Comment routes
commentRouter.post("/comments", authenticationToken, addComment);
commentRouter.get("/comments", authenticationToken, getComments);
commentRouter.get("/comments/task/:taskId", authenticationToken, getCommentsByTaskId);
commentRouter.get("/comments/:id", authenticationToken, getCommentById);
commentRouter.put("/comments/:id", authenticationToken, updateComment);
commentRouter.delete("/comments/:id", authenticationToken, deleteComment);

module.exports = {commentRouter};