import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Server } from "socket.io";
import http from "http";

const app = new Hono();

// Test route
app.get("/", (c) => c.text("Private Chat Server Running"));

// Create HTTP server
const server = http.createServer();

// Attach Hono
serve({
  fetch: app.fetch,
  port: 3000,
  createServer: () => server,
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONT_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a private room
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    console.log(`${username} joined room ${roomId}`);
  });

  // Send message to the room
  socket.on("send-message", ({ roomId, message }) => {
    const sender = socket.data.username || "Unknown";
    io.to(roomId).emit("receive-message", { sender, message });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

console.log("Server running on http://localhost:3000");