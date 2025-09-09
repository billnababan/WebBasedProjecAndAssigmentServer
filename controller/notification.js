const { query } = require("../utils/query");
const { v4: uuidv4 } = require("uuid");
const { successResponse, errorResponse } = require("../utils/response");

// Get all notifications for a user
const getUserNotifications = async (req, res) => {
  try {
    const userUuid = req.user.uuid;

    const notifications = await query(
      `
      SELECT 
        n.uuid, 
        n.user_uuid, 
        n.related_uuid, 
        n.type, 
        n.message, 
        n.is_read, 
        n.created_at,
        CASE 
          WHEN n.type = 'task' THEN t.task_name
          WHEN n.type = 'project' THEN p.project_name
          WHEN n.type = 'comment' THEN c.content
          ELSE NULL
        END AS related_content
      FROM notifications n
      LEFT JOIN task t ON n.related_uuid = t.uuid AND n.type = 'task'
      LEFT JOIN project p ON n.related_uuid = p.uuid AND n.type = 'project'
      LEFT JOIN comment c ON n.related_uuid = c.uuid AND n.type = 'comment'
      WHERE n.user_uuid = ?
      ORDER BY n.created_at DESC
      LIMIT 50
      `,
      [userUuid]
    );

    return successResponse(res, "Notifications retrieved successfully", { notifications });
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    return errorResponse(res, "Failed to retrieve notifications", 500);
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const userUuid = req.user.uuid;

    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_uuid = ? AND is_read = 0`,
      [userUuid]
    );

    const count = result.count;

    return successResponse(res, "Unread count retrieved successfully", { count });
  } catch (error) {
    console.error("Error retrieving unread count:", error);
    return errorResponse(res, "Failed to retrieve unread count", 500);
  }
};

// Mark a notification as read
const markAsRead = async (req, res) => {
  try {
    const userUuid = req.user.uuid;
    const notificationUuid = req.params.uuid;

    const notification = await query(
      `SELECT * FROM notifications WHERE uuid = ? AND user_uuid = ?`,
      [notificationUuid, userUuid]
    );

    if (!notification) {
      return errorResponse(res, "Notification not found", 404);
    }

    await query(
      `UPDATE notifications SET is_read = 1, updated_at = NOW() WHERE uuid = ?`,
      [notificationUuid]
    );

    return successResponse(res, "Notification marked as read", { success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return errorResponse(res, "Failed to mark notification as read", 500);
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userUuid = req.user.uuid;

    await query(
      `UPDATE notifications SET is_read = 1, updated_at = NOW() WHERE user_uuid = ?`,
      [userUuid]
    );

    return successResponse(res, "All notifications marked as read", { success: true });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return errorResponse(res, "Failed to mark all notifications as read", 500);
  }
};

// Create a notification (internal use)
const createNotification = async (userUuid, type, relatedUuid, message) => {
  try {
    const notificationUuid = uuidv4();

    await query(
      `
      INSERT INTO notifications 
      (uuid, user_uuid, type, related_uuid, message, is_read, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
      `,
      [notificationUuid, userUuid, type, relatedUuid, message]
    );

    return notificationUuid;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

// Create notifications for users by role
const createRoleNotification = async (role, type, relatedUuid, message) => {
  try {
    const users = await query(
      `SELECT uuid FROM users WHERE role = ? AND is_deleted = 0`,
      [role]
    );

    for (const user of users) {
      await createNotification(user.uuid, type, relatedUuid, message);
    }

    return true;
  } catch (error) {
    console.error("Error creating role notifications:", error);
    return false;
  }
};

// Create notifications for users in a project
const createProjectNotification = async (projectUuid, type, relatedUuid, message, excludeUserUuid = null) => {
  try {
    let sql = `
      SELECT u.uuid 
      FROM users u
      JOIN project_users pu ON u.uuid = pu.user_id
      WHERE pu.project_id = ? AND u.is_deleted = 0
    `;
    const params = [projectUuid];

    if (excludeUserUuid) {
      sql += ` AND u.uuid != ?`;
      params.push(excludeUserUuid);
    }

    const users = await query(sql, params);

    for (const user of users) {
      await createNotification(user.uuid, type, relatedUuid, message);
    }

    return true;
  } catch (error) {
    console.error("Error creating project notifications:", error);
    return false;
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const userUuid = req.user.uuid;
    const notificationUuid = req.params.uuid;

    const notification = await query(
      `SELECT * FROM notifications WHERE uuid = ? AND user_uuid = ?`,
      [notificationUuid, userUuid]
    );

    if (!notification) {
      return errorResponse(res, "Notification not found", 404);
    }

    await query(
      `DELETE FROM notifications WHERE uuid = ?`,
      [notificationUuid]
    );

    return successResponse(res, "Notification deleted successfully", { success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return errorResponse(res, "Failed to delete notification", 500);
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  createRoleNotification,
  createProjectNotification,
  deleteNotification
};
