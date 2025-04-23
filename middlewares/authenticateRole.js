
const jwt = require("jsonwebtoken");

const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log("decoded",decoded,allowedRoles)

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      next();
    } catch (err) {
      console.error("JWT Error:", err);
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  };
};

module.exports = authorizeRoles;
