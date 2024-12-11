const express = require("express");
const { authenticationToken } = require("../../middleware/auth");
const { addComment, getComments, getCommentById, updateComment, deleteComment } = require("../../controller/comment");

const commentRouter = express();

commentRouter.post("/comment", authenticationToken, addComment);
commentRouter.get("/comment", authenticationToken, getComments);
commentRouter.get("/comment/:id", authenticationToken, getCommentById);
commentRouter.put("/comment/:id", authenticationToken, updateComment);
commentRouter.delete("/comment/:id", authenticationToken, deleteComment);

module.exports = {
  commentRouter,
};
