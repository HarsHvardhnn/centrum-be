// controllers/userController.js

const bcrypt = require("bcrypt");
const user = require("../models/user-entity/user");
const createChatRoom = require("../utils/createChatroom");
const chatRoom = require("../models/chatRoom");

exports.addReceptionist = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, signupMethod } =
      req.body;

    const existingUser = await user.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already in use" });



    const newReceptionist = new user({
      name: { first: firstName, last: lastName },
      email,
      phone,
      password,
      role: "receptionist",
      signupMethod,
    });

    await newReceptionist.save();

    await createChatRoom(newReceptionist._id);
    res
      .status(201)
      .json({
        message: "Receptionist added successfully",
        user: newReceptionist,
      });
  } catch (error) {
    console.log("errpr",error)
    res.status(500).json({ message: "Server error", error:error.message });
  }
};


exports.markUserDeleted = async (req, res) => {
  try {
    const { userId } = req.params;

    const userDetails = await user.findByIdAndUpdate(
      userId,
      { deleted: true },
      { new: true }
    );

    if (!userDetails)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User marked as deleted", userDetails });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


exports.unMarkDeleted = async (req, res) => {
  try {
    const { userId } = req.params;

    const userDetails = await user.findByIdAndUpdate(
      userId,
      { deleted: false },
      { new: true }
    );

    if (!userDetails)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User marked as not deleted", userDetails });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getAllNonAdminUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.search || "";
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const query = { role: { $ne: "admin" } };

    if (searchTerm) {
      query.$or = [
        { "name.first": { $regex: searchTerm, $options: "i" } },
        { "name.last": { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Create sort object
    const sort = {};
    sort[sortField] = sortOrder;

    const [users, total] = await Promise.all([
      user
        .find(query)
        .select("name email phone role profilePicture signupMethod deleted")
        .skip(skip)
        .limit(limit)
        .sort(sort),

      user.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      users,
      pagination: {
        totalUsers: total,
        currentPage: page,
        totalPages,
        limit,
      },
    });
  } catch (error) {
    console.log(error, "error");
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const userDetails = await user.findById(id);
    if (!userDetails)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ userDetails });
  } catch (error) {
    res.status(500).json({ message: "Server error", error:error.message });
  }
};



exports.chatHistory=async (req, res) => {
  const userId  = req.user.id;

  try {
    const admin = await user.findOne({ role: "admin" });
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const chat = await chatRoom.findOne({ user: userId, admin: admin._id })
      .populate("messages.sender", "name _id") // optional: get sender name
      .lean();

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    res.json(chat.messages); // or res.json(chat) if you want metadata too
  } catch (err) {
    console.error("Error fetching chat:", err);
    res.status(500).json({ error: "Server error" });
  }
}