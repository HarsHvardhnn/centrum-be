const chatRoom = require("../models/chatRoom");
const user = require("../models/user-entity/user");

const createChatRoom = async (userId) => {
  try {
    // Step 1: Find the admin user
    const admin = await user.findOne({ role: "admin" }); 

    if (!admin) {
      throw new Error("Admin user not found");
    }

    // Step 2: Check if chat already exists between user and admin
    const existingChat = await chatRoom.findOne({ user: userId, admin: admin._id });

    if (existingChat) {
      return existingChat; // Already exists, return it
    }

    // Step 3: Create the new chat room
    const newChat = new chatRoom({
      user: userId,
      admin: admin._id,
      messages: [],
    });

    await newChat.save();
    return newChat;
  } catch (err) {
    console.error("Error creating chat room:", err.message);
    throw err;
  }
};

module.exports = createChatRoom;
