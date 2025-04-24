const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const doctorRoutes = require("./routes/doctor-routes");
const patientRoutes = require("./routes/patient-routes");
const adminRoutes = require("./routes/admin-routes");
const chatRoutes = require("./routes/chat-routes");
const appRoutes = require("./routes/appointment-routes");
const servicesRoutes=require("./routes/service-routes")
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); // Create HTTP server with Express
const io = new Server(server, {
  // Initialize Socket.IO with the HTTP server
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/docs", doctorRoutes);
app.use("/patients", patientRoutes);
app.use("/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/appointments", appRoutes);
app.use("/services", servicesRoutes);

// Import socket handler and pass io
const socketHandler = require("./config/socketHandler");
socketHandler(io);

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
// Use server.listen instead of app.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
