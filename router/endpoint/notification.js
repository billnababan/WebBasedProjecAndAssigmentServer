const express = require("express");
const { authenticationToken } = require("../../middleware/auth");
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require("../../controller/notification");

const notificationRouter = express.Router();

// Apply authentication middleware to all notification routes
notificationRouter.use(authenticationToken);

// Get all notifications for the authenticated user
notificationRouter.get("/notifications", getUserNotifications);

// Get unread notification count
notificationRouter.get("/notifications/unread-count", getUnreadCount);

// Mark a notification as read
notificationRouter.patch("/notifications/:uuid/read", markAsRead);

// Mark all notifications as read
notificationRouter.post("/notifications/mark-all-read", markAllAsRead);

// Delete a notification
notificationRouter.delete("/notifications/:uuid", deleteNotification);

module.exports = { notificationRouter };
