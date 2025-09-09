const socketIo = require("socket.io")

let io

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  })

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    // Join task-specific room
    socket.on("join-task", (taskId) => {
      socket.join(`task-${taskId}`)
      console.log(`User ${socket.id} joined task room: task-${taskId}`)
    })

    // Leave task room
    socket.on("leave-task", (taskId) => {
      socket.leave(`task-${taskId}`)
      console.log(`User ${socket.id} left task room: task-${taskId}`)
    })

    // Handle typing indicators
    socket.on("typing", (data) => {
      socket.to(`task-${data.taskId}`).emit("user-typing", {
        username: data.username,
        isTyping: data.isTyping,
      })
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
    })
  })

  return io
}

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!")
  }
  return io
}

module.exports = {
  initializeSocket,
  getIO,
}
