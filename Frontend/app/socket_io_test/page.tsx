'use client';
import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{
    message: string,
    sender: string
  }[]>([]);
  const [joined, setJoined] = useState(false);

  // Listen for messages
  useEffect(() => {
    socket.on("receive-message", (msg) => {
        const previousMessages = [...messages];
        previousMessages.push(msg)
        setMessages(previousMessages);
    });

    return () => {
      socket.off("receive-message");
    };
  }, []);

  const joinRoom = () => {
    if (!username || !roomId) return;
    socket.emit("join-room", { roomId, username });
    setJoined(true);
    setMessages([]); // clear messages when joining a new room
  };

  const sendMessage = () => {
    if (!message || !roomId) return;
    socket.emit("send-message", { roomId, message });
    setMessage("");
  };

  if (!joined) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Join Private Chat</h2>
        <input
          placeholder="Your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Room ID (e.g., user1-user2)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Private Chat: {roomId}</h2>

      <div
        style={{
          border: "1px solid gray",
          height: "300px",
          overflowY: "scroll",
          marginBottom: "10px",
          padding: "10px",
        }}
      >
        {messages.map((msg, i) => (
          <div key={i}>
            <b>{msg.sender}:</b> {msg.message}
          </div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;