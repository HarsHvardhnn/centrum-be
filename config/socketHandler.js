const chatRoom = require("../models/chatRoom");
const User = require("../models/user-entity/user");

// Store connected users globally
const connectedUsers = new Map();

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", (userId) => {
      console.log(`User ${userId} joined with socket ${socket.id}`);
      connectedUsers.set(userId, socket.id);
    });

    // User sends message to admin
    socket.on(
      "send-message",
      async ({ senderId, message, fileUrl, fileType, fileName }) => {
        try {
          console.log(
            "sender id",
            senderId,
            message,
            fileUrl ? "with file" : ""
          );
          const admin = await User.findOne({ role: "admin" });
          if (!admin) return console.error("Admin not found");

          const chat = await chatRoom.findOne({
            user: senderId,
            admin: admin._id,
          });

          if (!chat) return console.error("Chat room not found");

          const newMsg = {
            sender: senderId,
            message,
            timestamp: new Date(),
          };

          // Add file information if available
          if (fileUrl) {
            newMsg.fileUrl = fileUrl;
            newMsg.fileType = fileType;
            newMsg.fileName = fileName;
          }

          chat.messages.push(newMsg);
          await chat.save();

          // Use toString() to ensure consistent comparison
          const adminSocketId = connectedUsers.get(admin._id.toString());
          if (adminSocketId) {
            io.to(adminSocketId).emit("receive-message", {
              senderId,
              message,
              fileUrl,
              fileType,
              fileName,
            });
          }
        } catch (err) {
          console.error("Error handling send-message:", err);
        }
      }
    );

    // Admin replies to user
    socket.on(
      "send-admin-reply",
      async ({ receiverId, message, fileUrl, fileType, fileName }) => {
        try {
          const admin = await User.findOne({ role: "admin" });
          if (!admin) return console.error("Admin not found");

          const chat = await chatRoom.findOne({
            user: receiverId,
            admin: admin._id,
          });

          if (!chat) return console.error("Chat room not found");

          const newMsg = {
            sender: admin._id,
            message,
            timestamp: new Date(),
          };

          // Add file information if available
          if (fileUrl) {
            newMsg.fileUrl = fileUrl;
            newMsg.fileType = fileType;
            newMsg.fileName = fileName;
          }

          chat.messages.push(newMsg);
          await chat.save();

          const userSocketId = connectedUsers.get(receiverId);
          if (userSocketId) {
            io.to(userSocketId).emit("receive-admin-reply", {
              message,
              fileUrl,
              fileType,
              fileName,
            });
          }
        } catch (err) {
          console.error("Error handling send-admin-reply:", err);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
    });
  });
};

module.exports = socketHandler;
