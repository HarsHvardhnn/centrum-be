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
const { sendSMS } = require("../utils/smsapi");
const jwtConfig = require("../config/jwtConfig");

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
  // Get JWT expiry time from config (defaults to "1h" if not set)
  const jwtExpiryTime = jwtConfig.JWT_EXPIRY_TIME || "1h";
  const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
  
  // Access token - expiry time from config
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: jwtExpiryTime }
  );

  // Refresh token - longer lived (expiry from config)
  const refreshToken = crypto.randomBytes(40).toString("hex");

  // Calculate expiry date for refresh token (from config)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenExpiryDays);

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
      return res.status(400).json({ message: "Wszystkie pola są wymagane" });
    }

    // Check if role is valid
    const validRoles = ["patient", "doctor", "receptionist", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Nieprawidłowa rola" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email już zarejestrowany" });
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
      message: "OTP wysłany na email",
      email,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Błąd podczas rejestracji" });
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
        .json({ message: "Email, OTP i cel są wymagane" });
    }

    // Find the OTP record
    const otpRecord = await OTP.findOne({
      email,
      purpose,
    });

    if (!otpRecord) {
      return res.status(404).json({ message: "Nie znaleziono żądania OTP" });
    }

    // Check if OTP has expired
    if (otpRecord.hasExpired()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({ message: "OTP wygasł" });
    }

    // Check if max attempts exceeded
    if (otpRecord.attemptsExceeded()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res
        .status(429)
        .json({ message: "Zbyt wiele prób. Proszę poprosić o nowy OTP" });
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(401).json({
        message: "Nieprawidłowy OTP",
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
      const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: refreshTokenExpiryDays * 24 * 60 * 60 * 1000, // From config
      });

      // Return success with user data and access token
      return res.status(201).json({
        message: "Użytkownik zarejestrowany pomyślnie",
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
        message: "OTP zweryfikowany pomyślnie",
        email,
        resetToken: jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "15m",
        }),
      });
    }

    // If we get here, it's an unhandled purpose
    return res.status(400).json({ message: "Nieprawidłowy cel OTP" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Błąd podczas weryfikacji OTP" });
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
        .json({ message: "Email i hasło są wymagane" });
    }

    // Find the user
    const user = await User.findOne({ email,deleted: false });

    // Check if user exists
    if (!user) {
      // Increment failed login attempts even for non-existent users to prevent enumeration
      return res.status(401).json({ message: "Nieprawidłowe dane logowania" });
    }

    // Check if user role is patient - prevent patient login
    if (user.role === "patient") {
      return res.status(403).json({ 
        message: "Logowanie dla pacjentów jest niedozwolone" 
      });
    }

    // Check if user is locked out
    if (user.isLocked()) {
      return res.status(423).json({ 
        message: "Konto zostało zablokowane z powodu zbyt wielu nieudanych prób logowania. Spróbuj ponownie później.",
        lockedUntil: user.lockUntil
      });
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
      // Increment login attempts for wrong password
      await user.incLoginAttempts();
      return res.status(401).json({ message: "Nieprawidłowe dane logowania" });
    }

    // Password is correct, check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Send SMS code by default
      const smsResult = await send2FACode(user, 'sms');
      
      if (!smsResult.success) {
        return res.status(500).json({ 
          message: "Błąd podczas wysyłania kodu SMS. Spróbuj ponownie.",
          error: smsResult.error 
        });
      }

      // Create a temporary token for 2FA verification
      const tempToken = jwt.sign(
        { 
          id: user._id, 
          purpose: '2fa-verification',
          timestamp: Date.now()
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" } // 10 minutes to complete 2FA
      );

      return res.status(200).json({
        requiresTwoFactor: true,
        tempToken,
        message: "Kod weryfikacyjny został wysłany na Twój telefon",
        phone: `***${user.phone.slice(-3)}`, // Show only last 3 digits
        email: `***${user.email.slice(-3)}`, // Show last 3 chars of email
        availableMethods: ['sms', 'email', 'backup'] // Available verification methods
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

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
    const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60 * 1000, // From config
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
        phone: user.phone,
        profilePicture: user.profilePicture,
        singleSessionMode: user.singleSessionMode,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Błąd podczas logowania" });
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
        phone: user.phone,
        singleSessionMode: false,
      });
    }

    // Check if user role is patient - prevent patient login
    if (user.role === "patient") {
      return res.status(403).json({ 
        message: "Logowanie dla pacjentów jest niedozwolone" 
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
    const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60 * 1000, // From config
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
    res.status(401).json({ message: "Nieprawidłowy token Google" });
  }
};

// 5. Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("email", email);

    if (!email) {
      return res.status(400).json({ message: "Email jest wymagany" });
    }

    // Check if user exists
    const user = await User.findOne({ email:email.trim() });
    console.log("user", user);
    if (!user) {
      // For security reasons, we'll still respond with success
      // even if the user doesn't exist
      return res.status(200).json({
        message: "Jeśli twoj email jest zarejestrowany, otrzymaasz link do zresetowania hasła",
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

  // Create professional HTML email template for password reset OTP
  const createPasswordResetEmailHtml = (otp, userRole = 'Użytkownik') => {
    const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
    return `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Hasła - Centrum Medyczne</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .header {
                  background-color: #000000;
                  color: white;
                  padding: 20px;
                  text-align: center;
                  border-radius: 8px 8px 0 0;
              }
              .logo-container {
                  display: inline-block;
                  background-color: rgba(255, 255, 255, 0.95);
                  border-radius: 12px;
                  padding: 12px;
                  margin-bottom: 15px;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              }
              .logo {
                  max-width: 150px;
                  height: auto;
                  margin-bottom: 0;
                  background-color: transparent !important;
                  border-radius: 8px;
                  padding: 0;
                  /* Ensure logo is visible in both light and dark themes */
                  filter: brightness(1) contrast(1);
                  display: block;
              }
              /* Dark theme compatibility */
              @media (prefers-color-scheme: dark) {
                  .logo {
                      background-color: rgba(255, 255, 255, 0.1) !important;
                      filter: brightness(1.2) contrast(1.1);
                  }
              }
              .content {
                  background-color: #f9f9f9;
                  padding: 30px;
                  border-radius: 0 0 8px 8px;
                  border: 1px solid #ddd;
              }
              .otp-code {
                  background-color: #20B2AA;
                  color: white;
                  font-size: 32px;
                  font-weight: bold;
                  text-align: center;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 8px;
                  letter-spacing: 5px;
              }
              .warning {
                  background-color: #fff3cd;
                  border: 1px solid #ffeaa7;
                  color: #856404;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 20px 0;
              }
              .footer {
                  text-align: center;
                  margin-top: 30px;
                  font-size: 12px;
                  color: #666;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo-container">
                  <img src="${logoUrl}" alt="CM7MED Logo" class="logo" />
              </div>
              <h1>Centrum Medyczne</h1>
              <h2>Reset Hasła</h2>
          </div>
          
          <div class="content">
              <p>Witaj ${userRole},</p>
              
              <p>Otrzymałeś ten email, ponieważ zostało zgłoszone żądanie resetu hasła dla Twojego konta.</p>
              
              <p><strong>Twój kod weryfikacyjny to:</strong></p>
              
              <div class="otp-code">${otp}</div>
              
              <div class="warning">
                  <strong>⚠️ Ważne informacje:</strong>
                  <ul>
                      <li>Kod jest ważny przez <strong>10 minut</strong></li>
                      <li>Nie udostępniaj tego kodu nikomu</li>
                      <li>Jeśli nie zgłaszałeś resetu hasła, zignoruj ten email</li>
                      <li>Kod może być użyty tylko raz</li>
                  </ul>
              </div>
              
              <p>Jeśli masz problemy z dostępem do konta, skontaktuj się z administratorem systemu.</p>
              
              <p>Z poważaniem,<br>
              <strong>Zespół Centrum Medycznego</strong></p>
          </div>
          
          <div class="footer">
              <p>Ten email został wygenerowany automatycznie. Prosimy nie odpowiadać na tę wiadomość.</p>
          </div>
      </body>
      </html>
    `;
  };

  const html = createPasswordResetEmailHtml(otp, user?.role === 'doctor' ? 'Lekarz' : user?.role === 'receptionist' ? 'Recepcjonista' : 'Użytkownik');
  const text = `Centrum Medyczne - Reset Hasła\\n\\nTwój kod weryfikacyjny do resetu hasła: ${otp}\\n\\nKod jest ważny przez 10 minut. Nie udostępniaj go nikomu.\\n\\nJeśli nie zgłaszałeś resetu hasła, zignoruj ten email.\\n\\nZ poważaniem,\\nZespół Centrum Medycznego`;

  const response = await sendEmail({
      to: email,
      subject: "Reset Hasła - Kod Weryfikacyjny - Centrum Medyczne",
      html: html,
      text: text,
  });
    
    console.log("response", response);

    res.status(200).json({
      message: "OTP do zresetowania hasła wysłany na email",
      email,
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Błąd podczas żądania zresetowania hasła" });
  }
};

// 6. Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, email } = req.body;

    if (!resetToken || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token do zresetowania hasła i nowe hasło są wymagane" });
    }

    let decoded;
    decoded = await OTP.findOne({ email, otp: resetToken });
    if (!decoded) {
      return res.status(401).json({ message: "otp nieprawidłowy" });
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
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;

    // Invalidate all refresh tokens for security
    user.refreshTokens = [];

    await user.save();

    res.status(200).json({ message: "Hasło zresetowane pomyślnie" });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Błąd podczas zresetowania hasła" });
  }
};

// 7. Refresh token endpoint
const refreshToken = async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies.refreshToken;
  const ipAddress = req.ip;
  const device = req.headers["user-agent"] || "unknown";

  if (!refreshToken) {
    return res.status(401).json({ message: "Wymagany token odświeżania" });
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
        .json({ message: "Nieprawidłowy lub wygasły token odświeżania" });
    }

    // Remove the used refresh token
    await user.removeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = generateTokens(user, ipAddress, device, false);

    // Save user with new refresh token
    await user.save();

    // Set HTTP-only cookie with new refresh token
    const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60 * 1000, // From config
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
    res.status(500).json({ message: "Błąd serwera podczas odświeżania tokenu" });
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
  res.status(200).json({ message: "Wylogowano pomyślnie" });
};

// 9. Logout from all devices
const logoutAll = async (req, res) => {
  const userId = req.user.id; // From auth middleware

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    // Remove all refresh tokens
    await user.removeAllRefreshTokens();

    // Clear the refresh token cookie
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Wylogowano z wszystkich urządzeń" });
  } catch (err) {
    console.error("Logout all error:", err);
    res.status(500).json({ message: "Błąd serwera podczas wylogowania" });
  }
};

// 10. Toggle single session mode
const toggleSingleSessionMode = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
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
        .json({ message: "Email i cel są wymagane" });
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
    subject: "Twoj OTP do zresetowania hasła",
    html: `<p>Twoj OTP code to: <strong>${otp}</strong></p>`,
    text: `Twoj OTP code to: ${otp}`,
  });

    res.status(200).json({
      message: "Nowy OTP wysłany na email",
      email,
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Błąd podczas wysyłania nowego OTP" });
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
      return res.status(404).json({ message: "Użytkownik nie znaleziony lub usunięty" });
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
    res.status(500).json({ message: "Błąd serwera", error: error.message });
  }
};

// controllers/userController.js

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("userId", userId);
    // Find user by id but exclude sensitive information
    const userData = await user
      .findById(userId)
      .select("-password -refreshTokens");

    console.log("userData", userData);
    if (!userData) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    res.status(200).json({ success: true, data: userData });
  } catch (error) {
    console.error("Błąd podczas pobierania profilu użytkownika:", error);
    res.status(500).json({
      success: false,
      message: "Błąd podczas pobierania profilu",
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
        .json({ success: false, message: "Użytkownik nie znaleziony" });
    }

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Error updating user profile:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email już używany",
      });
    }

    res.status(500).json({
      success: false,
      message: "Błąd podczas aktualizacji profilu",
      error: error.message,
    });
  }
};

// Helper function to send 2FA code (SMS or Email)
const send2FACode = async (user, method = 'sms') => {
  try {
    // Generate 6-digit code
    const code = generateOTP();
    const purpose = method === 'sms' ? 'sms-2fa' : 'email-2fa';
    
    // Check if there's an existing 2FA OTP for this user and method
    const existingOTP = await OTP.findOne({ 
      userId: user._id, 
      purpose: purpose 
    });

    if (existingOTP) {
      // Check if user is blocked
      if (existingOTP.isBlocked()) {
        return {
          success: false,
          error: 'Konto tymczasowo zablokowane z powodu zbyt wielu prób. Spróbuj ponownie później.',
          blockedUntil: existingOTP.blockedUntil
        };
      }

      // Update existing OTP
      existingOTP.otp = code;
      existingOTP.attempts = 0;
      existingOTP.createdAt = new Date();
      existingOTP.verified = false;
      existingOTP.deliveryMethod = method;
      await existingOTP.save();
    } else {
      // Create new OTP record
      const newOTP = new OTP({
        userId: user._id,
        email: method === 'email' ? user.email : undefined,
        phone: method === 'sms' ? user.phone : undefined,
        otp: code,
        purpose: purpose,
        deliveryMethod: method,
        attempts: 0,
        verified: false
      });
      await newOTP.save();
    }

    if (method === 'sms') {
      // Check if we're in development environment
      if (process.env.NODE_ENV === 'development') {
        // In development, just simulate SMS sending to save credits
        console.log(`[DEV MODE] SMS 2FA code would be sent to ${user.phone}: ${code}`);
        console.log(`[DEV MODE] Simulating successful SMS delivery for user ${user._id}`);
        return { 
          success: true, 
          messageId: `dev-sim-${Date.now()}`, 
          method: 'sms',
          simulated: true 
        };
      } else {
        // In production, send actual SMS
        const message = `CM7Med- Twoj kod weryfikacyjny: ${code}. Kod jest wazny przez 5 minut. Nie udostepniaj go nikomu!`;
        const smsResult = await sendSMS(user.phone, message,"CM7Med");

        if (smsResult.success) {
          console.log(`SMS 2FA code sent to user ${user._id}`);
          return { success: true, messageId: smsResult.messageId, method: 'sms' };
        } else {
          console.error(`Failed to send SMS 2FA code to user ${user._id}:`, smsResult.error);
          return { success: false, error: smsResult.error };
        }
      }
    } else {
      // Send Email with branded template
      const emailResult = await sendBranded2FAEmail(user.email, code, user.name);
      
      if (emailResult.success) {
        console.log(`Email 2FA code sent to user ${user._id}`);
        return { success: true, messageId: emailResult.messageId, method: 'email' };
      } else {
        console.error(`Failed to send Email 2FA code to user ${user._id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    }

  } catch (error) {
    console.error('Error in send2FACode:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to send branded 2FA email
const sendBranded2FAEmail = async (email, code, userName) => {
  try {
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kod weryfikacyjny - CM7Med</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #007bff; }
        .logo { max-width: 200px; height: auto; }
        .content { padding: 30px 0; text-align: center; }
        .code-box { background: #f8f9fa; border: 2px dashed #007bff; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://cm7med.co.uk/logo.png" alt="CM7 Medical" class="logo">
          <h1 style="color: #007bff; margin: 10px 0;">CM7 Medical</h1>
        </div>
        
        <div class="content">
          <h2>Kod weryfikacyjny dwuskładnikowej</h2>
          <p>Witaj ${userName.first} ${userName.last},</p>
          <p>Twój kod weryfikacyjny do logowania:</p>
          
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Ważne:</strong>
            <ul style="text-align: left; margin: 10px 0;">
              <li>Kod jest ważny przez <strong>5 minut</strong></li>
              <li>Nie udostępniaj tego kodu nikomu</li>
              <li>Jeśli to nie Ty próbujesz się zalogować, skontaktuj się z administratorem</li>
            </ul>
          </div>
          
          <p>Jeśli masz problemy z logowaniem, skontaktuj się z naszym zespołem technicznym.</p>
        </div>
        
        <div class="footer">
          <p>© 2024 CM7 Medical. Wszystkie prawa zastrzeżone.</p>
          <p>Ten email został wysłany z: admin@cm7med.pl</p>
          <p>Nie odpowiadaj na ten email - jest wysyłany automatycznie.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const emailText = `
CM7 Medical - Kod weryfikacyjny

Witaj ${userName.first} ${userName.last},

Twój kod weryfikacyjny do logowania: ${code}

WAŻNE:
- Kod jest ważny przez 5 minut
- Nie udostępniaj tego kodu nikomu
- Jeśli to nie Ty próbujesz się zalogować, skontaktuj się z administratorem

© 2024 CM7 Medical
Email wysłany z: admin@cm7med.pl
    `;

    const result = await sendEmail({
      to: email,
      subject: 'CM7 Medical - Kod weryfikacyjny dwuskładnikowej',
      html: emailHtml,
      text: emailText,
      from: 'admin@cm7med.pl'
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending branded 2FA email:', error);
    return { success: false, error: error.message };
  }
};

// Verify 2FA code (SMS, Email, or Backup Code) and complete login
const verify2FA = async (req, res) => {
  try {
    const { tempToken, smsCode, emailCode, backupCode } = req.body;
    const ipAddress = req.ip;
    const device = req.headers["user-agent"] || "unknown";

    // Validate input - at least one verification method required
    if (!tempToken || (!smsCode && !emailCode && !backupCode)) {
      return res.status(400).json({ 
        message: "Token tymczasowy i kod weryfikacyjny (SMS, email lub kod zapasowy) są wymagane" 
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ 
        message: "Token tymczasowy jest nieprawidłowy lub wygasł" 
      });
    }

    if (decoded.purpose !== '2fa-verification') {
      return res.status(401).json({ 
        message: "Nieprawidłowy token weryfikacyjny" 
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        message: "Użytkownik nie znaleziony" 
      });
    }

    // Handle backup code verification
    if (backupCode) {
      const backupCodeIndex = user.twoFactorBackupCodes.findIndex(
        bc => bc.code === backupCode && !bc.used
      );

      if (backupCodeIndex === -1) {
        return res.status(401).json({
          message: "Nieprawidłowy lub już użyty kod zapasowy"
        });
      }

      // Mark backup code as used
      user.twoFactorBackupCodes[backupCodeIndex].used = true;
      user.twoFactorBackupCodes[backupCodeIndex].usedAt = new Date();
      await user.save();

      // Complete login with backup code
      return await complete2FALogin(user, ipAddress, device, res, "Logowanie zakończone pomyślnie przy użyciu kodu zapasowego");
    }

    // Handle SMS or Email code verification
    const verificationCode = smsCode || emailCode;
    const purpose = smsCode ? 'sms-2fa' : 'email-2fa';

    // Find OTP record
    const otpRecord = await OTP.findOne({
      userId: user._id,
      purpose: purpose
    });

    if (!otpRecord) {
      return res.status(404).json({ 
        message: "Kod weryfikacyjny nie znaleziony. Proszę zalogować się ponownie." 
      });
    }

    // Check if OTP is blocked
    if (otpRecord.isBlocked()) {
      return res.status(423).json({ 
        message: "Konto tymczasowo zablokowane z powodu zbyt wielu nieudanych prób. Spróbuj ponownie później.",
        blockedUntil: otpRecord.blockedUntil
      });
    }

    // Check if OTP has expired
    if (otpRecord.hasExpired()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(410).json({ 
        message: "Kod weryfikacyjny wygasł. Proszę zalogować się ponownie." 
      });
    }

    // Check if max attempts exceeded
    if (otpRecord.attemptsExceeded()) {
      await otpRecord.blockUser(); // Block for 15 minutes
      return res.status(429).json({ 
        message: "Zbyt wiele nieudanych prób. Konto zostało tymczasowo zablokowane.",
        blockedUntil: otpRecord.blockedUntil
      });
    }

    // Verify code
    if (otpRecord.otp !== verificationCode) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      
      return res.status(401).json({
        message: "Nieprawidłowy kod weryfikacyjny",
        attemptsLeft: otpRecord.maxAttempts - otpRecord.attempts
      });
    }

    // Code is correct - complete login
    otpRecord.verified = true;
    await otpRecord.save();

    // Clean up OTP record
    await OTP.deleteOne({ _id: otpRecord._id });

    // Complete login
    return await complete2FALogin(user, ipAddress, device, res, "Logowanie zakończone pomyślnie");

  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(500).json({ message: "Błąd podczas weryfikacji kodu" });
  }
};

// Helper function to complete 2FA login
const complete2FALogin = async (user, ipAddress, device, res, message = "Logowanie zakończone pomyślnie") => {
  try {
    // Reset user login attempts
    await user.resetLoginAttempts();

    // Generate full tokens
    const { accessToken, refreshToken } = generateTokens(
      user,
      ipAddress,
      device,
      false,
      false
    );

    // Save user with refresh token
    await user.save();

    // Set HTTP-only cookie
    const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS || 30;
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: refreshTokenExpiryDays * 24 * 60 * 60 * 1000, // From config
    });

    // Send successful response
    return res.status(200).json({
      message,
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        d_id: user.d_id || "",
        name: `${user.name.first} ${user.name.last}`,
        role: user.role,
        phone: user.phone,
        profilePicture: user.profilePicture,
        singleSessionMode: user.singleSessionMode,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("Error completing 2FA login:", error);
    return res.status(500).json({ message: "Błąd podczas finalizacji logowania" });
  }
};

// Resend 2FA code (SMS or Email)
const resend2FACode = async (req, res) => {
  try {
    const { tempToken, method = 'sms' } = req.body;

    // Validate input
    if (!tempToken) {
      return res.status(400).json({ 
        message: "Token tymczasowy jest wymagany" 
      });
    }

    if (!['sms', 'email'].includes(method)) {
      return res.status(400).json({ 
        message: "Nieprawidłowa metoda wysyłania (sms lub email)" 
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ 
        message: "Token tymczasowy jest nieprawidłowy lub wygasł" 
      });
    }

    if (decoded.purpose !== '2fa-verification') {
      return res.status(401).json({ 
        message: "Nieprawidłowy token weryfikacyjny" 
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        message: "Użytkownik nie znaleziony" 
      });
    }

    const purpose = method === 'sms' ? 'sms-2fa' : 'email-2fa';

    // Find existing OTP record for the requested method
    const otpRecord = await OTP.findOne({
      userId: user._id,
      purpose: purpose
    });

    if (otpRecord) {
      // Check if user can resend (1 minute cooldown)
      if (!otpRecord.canResend()) {
        return res.status(429).json({ 
          message: "Możesz poprosić o nowy kod za minutę",
          canResendAt: new Date(otpRecord.lastResendAt.getTime() + 60 * 1000)
        });
      }

      // Check if user is blocked
      if (otpRecord.isBlocked()) {
        return res.status(423).json({ 
          message: "Konto tymczasowo zablokowane. Spróbuj ponownie później.",
          blockedUntil: otpRecord.blockedUntil
        });
      }

      // Update resend timestamp
      otpRecord.lastResendAt = new Date();
      await otpRecord.save();
    }

    // Send new code
    const result = await send2FACode(user, method);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: `Błąd podczas wysyłania kodu ${method === 'sms' ? 'SMS' : 'email'}`, 
        error: result.error 
      });
    }

    const responseMessage = method === 'sms' 
      ? "Nowy kod SMS został wysłany" 
      : "Nowy kod email został wysłany";

    const responseData = {
      message: responseMessage,
      method: method
    };

    if (method === 'sms') {
      responseData.phone = `***${user.phone.slice(-3)}`;
    } else {
      responseData.email = `***${user.email.slice(-3)}`;
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error("Resend 2FA code error:", error);
    res.status(500).json({ message: "Błąd podczas ponownego wysyłania kodu" });
  }
};

// Request email fallback for 2FA
const requestEmailFallback = async (req, res) => {
  try {
    const { tempToken } = req.body;

    // Validate input
    if (!tempToken) {
      return res.status(400).json({ 
        message: "Token tymczasowy jest wymagany" 
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ 
        message: "Token tymczasowy jest nieprawidłowy lub wygasł" 
      });
    }

    if (decoded.purpose !== '2fa-verification') {
      return res.status(401).json({ 
        message: "Nieprawidłowy token weryfikacyjny" 
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        message: "Użytkownik nie znaleziony" 
      });
    }

    // Check if user has email
    if (!user.email) {
      return res.status(400).json({ 
        message: "Brak adresu email przypisanego do konta" 
      });
    }

    // Send email fallback code
    const emailResult = await send2FACode(user, 'email');
    
    if (!emailResult.success) {
      return res.status(500).json({ 
        message: "Błąd podczas wysyłania kodu email", 
        error: emailResult.error 
      });
    }

    res.status(200).json({
      message: "Kod weryfikacyjny został wysłany na Twój email jako alternatywa",
      email: `***${user.email.slice(-3)}`,
      method: 'email'
    });

  } catch (error) {
    console.error("Request email fallback error:", error);
    res.status(500).json({ message: "Błąd podczas wysyłania kodu email" });
  }
};

// Enable/Disable 2FA
const toggle2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enable, password:currentPassword } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    // Verify current password - check plain text first, then bcrypt
    let passwordMatches = false;
    
    console.log("currentPassword", currentPassword);
    console.log("user.password", user.password);
    // First check if password matches in plain text
    if (currentPassword === user.password) {
      passwordMatches = true;
    } else {
      // If plain text doesn't match, try bcrypt comparison
      try {
        passwordMatches = await bcrypt.compare(currentPassword, user.password);
      } catch (error) {
        console.error("Bcrypt comparison error:", error);
        passwordMatches = false;
      }
    }
    
    if (!passwordMatches) {
      return res.status(400).json({ message: "Nieprawidłowe hasło" });
    }

    // Check if user has phone number
    if (!user.phone) {
      return res.status(400).json({ 
        message: "Numer telefonu jest wymagany do włączenia 2FA" 
      });
    }

    if (enable) {
      // Enabling 2FA
      if (user.twoFactorEnabled) {
        return res.status(400).json({ 
          message: "Uwierzytelnianie dwuskładnikowe jest już włączone" 
        });
      }

      // Encrypt phone number
      user.encryptPhone();
      user.twoFactorEnabled = true;

      // Generate backup codes
      const backupCodes = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push({
          code: crypto.randomBytes(4).toString('hex').toUpperCase(),
          used: false
        });
      }
      user.twoFactorBackupCodes = backupCodes;

      await user.save();

      res.status(200).json({
        message: "Uwierzytelnianie dwuskładnikowe zostało włączone",
        backupCodes: backupCodes.map(bc => bc.code),
        warning: "Zapisz te kody zapasowe w bezpiecznym miejscu. Nie będą ponownie wyświetlone."
      });

    } else {
      // Disabling 2FA
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ 
          message: "Uwierzytelnianie dwuskładnikowe nie jest włączone" 
        });
      }

      user.twoFactorEnabled = false;
      user.encryptedPhone = undefined;
      user.twoFactorBackupCodes = [];

      await user.save();

      // Clean up any existing 2FA OTP records
      await OTP.deleteMany({ userId: user._id, purpose: 'sms-2fa' });

      res.status(200).json({
        message: "Uwierzytelnianie dwuskładnikowe zostało wyłączone"
      });
    }

  } catch (error) {
    console.error("Toggle 2FA error:", error);
    res.status(500).json({ message: "Błąd podczas zmiany ustawień 2FA" });
  }
};

// Get 2FA status
const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('twoFactorEnabled phone');
    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }

    res.status(200).json({
      twoFactorEnabled: user.twoFactorEnabled,
      hasPhone: !!user.phone,
      phone: user.phone ? `***${user.phone.slice(-3)}` : null
    });

  } catch (error) {
    console.error("Get 2FA status error:", error);
    res.status(500).json({ message: "Błąd podczas pobierania statusu 2FA" });
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
  // 2FA functions
  verify2FA,
  resend2FACode,
  requestEmailFallback,
  toggle2FA,
  get2FAStatus,
};
