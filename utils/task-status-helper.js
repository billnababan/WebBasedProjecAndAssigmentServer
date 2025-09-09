/**
 * Helper function to check if a task has a pending completion request
 * This can be used by the frontend to show a "Pending Review" state
 * even though the database status is still "In Progress"
 */
const getTaskDisplayStatus = async (taskId, queryFunc) => {
  try {
    // Check if there's a pending completion request
    const pendingRequests = await queryFunc(
      `SELECT * FROM task_completion_requests 
       WHERE task_uuid = ? AND status = 'pending'`,
      [taskId],
    )

    // Get the actual task status
    const taskResult = await queryFunc(`SELECT status FROM task WHERE uuid = ?`, [taskId])

    if (taskResult.length === 0) {
      return null // Task not found
    }

    const actualStatus = taskResult[0].status

    // If there's a pending request and the task is not completed,
    // return "Pending Review" as the display status
    if (pendingRequests.length > 0 && actualStatus !== "Completed") {
      return "Pending Review"
    }

    // Otherwise return the actual status
    return actualStatus
  } catch (error) {
    console.error("Error getting task display status:", error)
    return null
  }
}

module.exports = {
  getTaskDisplayStatus,
}
