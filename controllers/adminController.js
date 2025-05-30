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
        message: "Recepcjonista dodany pomyślnie",
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
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });

    res.status(200).json({ message: "Użytkownik oznaczony jako usunięty", userDetails });
  } catch (error) {
    res.status(500).json({ message: "Błąd serwera", error });
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
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });

    res.status(200).json({ message: "Użytkownik oznaczony jako nie usunięty", userDetails });
  } catch (error) {
    res.status(500).json({ message: "Błąd serwera", error });
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

    let query = {};

    if (req.user.role === 'admin') {
      query = { role: { $ne: 'admin' } };
    } else if (req.user.role === 'receptionist') {
      query = { role: 'patient' };
    } else if (req.user.role === 'doctor') {
      query = { 
        role: 'patient',
        consultingDoctor: req.user.id 
      };
    }
    

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      query.$or = [
        { 
          $expr: {
            $regexMatch: {
              input: { $toLower: { $concat: ["$name.first", " ", "$name.last"] } },
              regex: searchLower,
              options: "i"
            }
          }
        },
        { email: { $regex: searchLower, $options: "i" } },
        { phone: { $regex: searchLower, $options: "i" } }
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
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });

    res.status(200).json({ userDetails });
  } catch (error) {
    res.status(500).json({ message: "Błąd serwera", error:error.message });
  }
};



exports.chatHistory=async (req, res) => {
  const userId  = req.user.id;

  try {
    const admin = await user.findOne({ role: "admin" });
    if (!admin) return res.status(404).json({ error: "Admin nie znaleziony" });

    const chat = await chatRoom.findOne({ user: userId, admin: admin._id })
      .populate("messages.sender", "name _id") // optional: get sender name
      .lean();

    if (!chat) return res.status(404).json({ error: "Chat nie znaleziony" });

    res.json(chat.messages); // or res.json(chat) if you want metadata too
  } catch (err) {
    console.error("Error fetching chat:", err);
    res.status(500).json({ error: "Server error" });
  }
}