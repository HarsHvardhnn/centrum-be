const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/user-entity/user");
const OTP = require("../models/otp");
const nodemailer = require("nodemailer");
const sendEmail = require("../utils/mailer");
const createChatRoom = require("../utils/createChatroom");
const user = require("../models/user-entity/user");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate OTP
const generateOTP = () => {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send OTP via email

// Helper function to generate tokens
const generateTokens = (
  user,
  ipAddress,
  device,
  shouldSave = true,
  enforceSingleSession = false
) => {
  // Access token - short lived (15 minutes)
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  // Refresh token - longer lived (30 days)
  const refreshToken = crypto.randomBytes(40).toString("hex");

  // Calculate expiry date for refresh token (30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // For single session mode, remove all existing tokens if that feature is enabled
  if (user.singleSessionMode || enforceSingleSession) {
    // Clear all existing tokens
    user.refreshTokens = [];
  }

  // Add refresh token to user's tokens array
  user.refreshTokens.push({
    token: refreshToken,
    expiresAt,
    device: device || "unknown",
    ipAddress: ipAddress || "unknown",
    createdAt: new Date(),
  });

  // Clean expired tokens whenever we generate new ones
  if (user.refreshTokens.length > 0) {
    const now = new Date();
    user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt > now);
  }

  // Only save if flag is true
  if (shouldSave) {
    user.save().catch((err) => console.error("Error saving user tokens:", err));
  }

  return { accessToken, refreshToken };
};

// 1. SIGNUP: First step - Request OTP for email verification
const signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    // Validate inputs
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if role is valid
    const validRoles = ["patient", "doctor", "receptionist", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const otp = generateOTP();

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newOTP = new OTP({
      email,
      otp,
      purpose: "signup",
      userData: {
        name: { first: firstName, last: lastName },
        email,
        password: hashedPassword,
        role,
        phone: phone || "",
        signupMethod: "email",
        refreshTokens: [],
      },
    });

    await newOTP.save();

    // Send OTP via email
    await sendEmail({
      to: email,
      subject: "Your OTP for Signup",
      html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
      text: `Your OTP code is: ${otp}`,
    });
    res.status(200).json({
      message: "OTP sent to your email",
      email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Error during signup" });
  }
};

// 2. VERIFY OTP and complete signup
const verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose, password } = req.body;
    const ipAddress = req.ip;
    const device = req.headers["user-agent"] || "unknown";

    // Validate inputs
    const saltRounds = 10;

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    if (!email || !otp || !purpose) {
      return res
        .status(400)
        .json({ message: "Email, OTP and purpose are required" });
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({
      email,
      purpose,
    });

    if (!otpRecord) {
      return res.status(404).json({ message: "No OTP request found" });
    }

    // Check if OTP has expired
    if (otpRecord.hasExpired()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({ message: "OTP has expired" });
    }

    // Check if max attempts exceeded
    if (otpRecord.attemptsExceeded()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res
        .status(429)
        .json({ message: "Too many attempts. Please request a new OTP" });
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(401).json({
        message: "Invalid OTP",
        attemptsLeft: otpRecord.maxAttempts - otpRecord.attempts,
      });
    }

    // Handle different OTP purposes
    if (purpose === "signup") {
      // Create the new user
      const userData = {
        name: {
          first: req.body.firstName || otpRecord.userData?.firstName,
          last: req.body.lastName || otpRecord.userData?.lastName,
        },
        email,
        password: hashedPassword || otpRecord.userData?.password,
        role: "patient",
        patientId: `P-${new Date().getTime()}`,
        phone: req.body.phone || otpRecord.userData?.phone || "",
        signupMethod: "email",
        profilePicture: "",
        refreshTokens: [],
        singleSessionMode: false,
      };

      const newUser = new User(userData);
      await createChatRoom(newUser._id);

      await newUser.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        newUser,
        ipAddress,
        device,
        false
      );

      // Save user with tokens
      await newUser.save();

      // Mark OTP as verified and delete it
      otpRecord.verified = true;
      await otpRecord.save();
      await OTP.deleteOne({ _id: otpRecord._id });

      // Set refresh token cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Return success with user data and access token
      return res.status(201).json({
        message: "User registered successfully",
        token: accessToken,
        user: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      });
    } else if (purpose === "password-reset") {
      // Mark the OTP as verified for password reset
      otpRecord.verified = true;
      await otpRecord.save();

      return res.status(200).json({
        message: "OTP verified successfully",
        email,
        resetToken: jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "15m",
        }),
      });
    }

    // If we get here, it's an unhandled purpose
    return res.status(400).json({ message: "Invalid OTP purpose" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Error during OTP verification" });
  }
};

// 3. LOGIN: Standard email/password login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const device = req.headers["user-agent"] || "unknown";
    const enforceSingleSession = req.body.enforceSingleSession || false;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find the user
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if password matches
    let passwordMatches = false;

    if (user && user.password) {
      passwordMatches = await bcrypt
        .compare(password, user.password)
        .catch(() => false); // if bcrypt throws for any reason, treat it as false

      // fallback to normal string comparison
      if (!passwordMatches && password === user.password) {
        passwordMatches = true;
      }
    }
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user,
      ipAddress,
      device,
      false,
      enforceSingleSession
    );

    // Save the user with the refresh token
    await user.save();

    // Set HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send response
    res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        d_id: user.d_id || "",
        name: `${user.name.first} ${user.name.last}`,
        role: user.role,
        profilePicture: user.profilePicture,
        singleSessionMode: user.singleSessionMode,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
};

// 4. GOOGLE LOGIN: Login or signup via Google
const googleLogin = async (req, res) => {
  const { token } = req.body;
  const ipAddress = req.ip;
  const device = req.headers["user-agent"] || "unknown";
  const enforceSingleSession = req.body.enforceSingleSession || false;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      const [first, ...rest] = name.split(" ");
      const last = rest.join(" ");

      const randomPassword = crypto.randomBytes(20).toString("hex");
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      user = new User({
        name: { first, last },
        email,
        d_id: `dr-${Date.now()}`,
        password: hashedPassword,
        role: "doctor",
        profilePicture: picture,
        signupMethod: "google",
        refreshTokens: [],
        singleSessionMode: false,
      });
    }

    // Generate tokens but don't save within the function
    const { accessToken, refreshToken } = generateTokens(
      user,
      ipAddress,
      device,
      false,
      enforceSingleSession
    );

    // Save the user with the new refresh token ONCE
    await user.save();

    await createChatRoom(user._id);

    // Set HTTP-only cookie with refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send access token in response body
    res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        d_id: user.d_id || "",
        email: user.email,
        name: `${user.name.first} ${user.name.last}`,
        role: user.role,
        profilePicture: user.profilePicture,
        singleSessionMode: user.singleSessionMode,
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(401).json({ message: "Invalid Google token" });
  }
};

// 5. Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({ email:email.trim() });
    console.log("user", user);
    if (!user) {
      // For security reasons, we'll still respond with success
      // even if the user doesn't exist
      return res.status(200).json({
        message: "If your email is registered, you'll receive a reset link",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP
    const newOTP = new OTP({
      email,
      otp,
      purpose: "password-reset",
    });

    await newOTP.save();

  const response=  await sendEmail({
      to: email,
      subject: "Your OTP for Password Reset",
      html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
      text: `Your OTP code is: ${otp}`,
  });
    
    console.log("response", response);

    res.status(200).json({
      message: "Password reset OTP sent to your email",
      email,
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Error during password reset request" });
  }
};

// 6. Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, email } = req.body;

    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json({ message: "Reset token and new password are required" });
    }

    let decoded;
    decoded = await OTP.findOne({ email, otp: resetToken });
    if (!decoded) {
      return res.status(401).json({ message: "otp invalid" });
    }

    // try {
    //   decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    // } catch (err) {
    //   return res
    //     .status(401)
    //     .json({ message: "Invalid or expired reset token" });
    // }

    // Find user
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;

    // Invalidate all refresh tokens for security
    user.refreshTokens = [];

    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Error during password reset" });
  }
};

// 7. Refresh token endpoint
const refreshToken = async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies.refreshToken;
  const ipAddress = req.ip;
  const device = req.headers["user-agent"] || "unknown";

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    // Find user with this refresh token
    const user = await User.findOne({
      "refreshTokens.token": refreshToken,
      "refreshTokens.expiresAt": { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    // Remove the used refresh token
    await user.removeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = generateTokens(user, ipAddress, device, false);

    // Save user with new refresh token
    await user.save();

    // Set HTTP-only cookie with new refresh token
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send new access token
    res.status(200).json({
      token: tokens.accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePicture: user.profilePicture,
        singleSessionMode: user.singleSessionMode,
      },
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Server error during token refresh" });
  }
};

// 8. Logout endpoint
const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const user = await User.findOne({ "refreshTokens.token": refreshToken });

      if (user) {
        await user.removeRefreshToken(refreshToken);
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  // Clear the refresh token cookie
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// 9. Logout from all devices
const logoutAll = async (req, res) => {
  const userId = req.user.id; // From auth middleware

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove all refresh tokens
    await user.removeAllRefreshTokens();

    // Clear the refresh token cookie
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out from all devices" });
  } catch (err) {
    console.error("Logout all error:", err);
    res.status(500).json({ message: "Server error during logout" });
  }
};

// 10. Toggle single session mode
const toggleSingleSessionMode = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Toggle the setting
    user.singleSessionMode = !user.singleSessionMode;

    // If enabling single session mode, remove all tokens except the current one
    if (user.singleSessionMode) {
      const currentToken = req.cookies.refreshToken;
      if (currentToken) {
        user.refreshTokens = user.refreshTokens.filter(
          (t) => t.token === currentToken
        );
      }
    }

    await user.save();

    res.status(200).json({
      message: `Single session mode ${
        user.singleSessionMode ? "enabled" : "disabled"
      }`,
      singleSessionMode: user.singleSessionMode,
    });
  } catch (err) {
    console.error("Toggle single session mode error:", err);
    res
      .status(500)
      .json({ message: "Server error when toggling single session mode" });
  }
};

// 11. Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res
        .status(400)
        .json({ message: "Email and purpose are required" });
    }

    // Delete any existing OTPs for this email and purpose
    await OTP.deleteMany({ email, purpose });

    // Generate new OTP
    const otp = generateOTP();

    // Store new OTP
    const newOTP = new OTP({
      email,
      otp,
      purpose,
    });

    await newOTP.save();

    // Send OTP via email
  const response = await sendEmail({
    to: email,
    subject: "Your OTP for Password Reset",
    html: `<p>Your OTP code is: <strong>${otp}</strong></p>`,
    text: `Your OTP code is: ${otp}`,
  });

    res.status(200).json({
      message: "New OTP sent to your email",
      email,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Error resending OTP" });
  }
};

const getUserPublicInfo = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findOne(
      { _id: userId, deleted: false },
      {
        "name.first": 1,
        "name.last": 1,
        email: 1,
        phone: 1,
        role: 1,
        profilePicture: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found or deleted" });
    }

    res.json({
      user: {
        name: `${user.name.first} ${user.name.last}`,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// controllers/userController.js

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user by id but exclude sensitive information
    const userData = await user
      .findById(userId)
      .select("-password -refreshTokens");

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, data: userData });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, phone, sex } = req.body;
    console.log("req.body", name);

    // Build update object with only provided fields
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
     
    }

    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (sex !== undefined) updateData.sex = sex;
    if (req?.file?.path) updateData.profilePicture = req.file.path;

    // Find and update user
    const updatedUser = await user
      .findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      )
      .select("-password -refreshTokens");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

module.exports = {
  signup,
  verifyOTP,
  login,
  googleLogin,
  requestPasswordReset,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  toggleSingleSessionMode,
  resendOtp,
  getUserPublicInfo,
  getProfile,
  updateProfile,
};
