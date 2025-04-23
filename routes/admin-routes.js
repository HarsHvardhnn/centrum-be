// routes/userRoutes.js

const express = require("express");
const router = express.Router();
const {
  addReceptionist,
  markUserDeleted,
  getAllNonAdminUsers,
  unMarkDeleted,
  getUserById,
  chatHistory,
} = require("../controllers/adminController");
const authorizeRoles = require("../middlewares/authenticateRole");

router.post("/receptionists", authorizeRoles(["admin"]),addReceptionist);

router.patch("/users/:userId/delete", authorizeRoles(["admin"]), markUserDeleted);
router.patch(
  "/users/:userId/revive",
  authorizeRoles(["admin"]),
  unMarkDeleted
);

router.get("/users/non-admins", authorizeRoles(["admin"]), getAllNonAdminUsers);
router.get("/users/:id", authorizeRoles(["admin"]), getUserById);
router.get("/history/chats", authorizeRoles(["admin","doctor","receptionist"]), chatHistory);

module.exports = router;
