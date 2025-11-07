import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupChatRoutes from "./routes/groupChat.route.js"; // Import group chat routes
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

// Increase JSON body limit to allow base64 image payloads from the frontend
app.use(express.json({ limit: "10mb" })); // req.body

// ✅ Choose CORS origin based on environment
if (ENV.NODE_ENV === "development") {
  app.use(
    cors({
      origin: ENV.CLIENT_URL, // e.g. http://localhost:5173
      credentials: true,
    })
  );
} else {
  app.use(
    cors({
      origin: ["https://network-chatapp.vercel.app"], // 🔥 your Vercel frontend domain
      credentials: true,
    })
  );
}

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groupChat", groupChatRoutes); // Add group chat routes

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  connectDB();
});
