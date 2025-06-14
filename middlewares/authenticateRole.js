const jwt = require("jsonwebtoken");

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    let token = null;

    // Try to get token from cookie first
    if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    } 
    // Fallback to Bearer token in Authorization header
    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log("decoded", decoded, allowedRoles);

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      // Set secure cookie with token if it came from Authorization header
      // This helps migrate existing clients to use cookies
      if (!req.cookies?.authToken) {
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          path: '/'
        });
      }

      next();
    } catch (err) {
      console.error("JWT Error:", err);
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  };
};

module.exports = authorizeRoles;
