// Helper function to extract query params
const getWsParams = (c: any) => {
  const url = new URL(String(c.req.url), `http://${c.req.headers.get('host') || 'localhost'}`);
  return {
    roomId: Number(url.searchParams.get("roomId")),
    userId: Number(url.searchParams.get("userId")),
  };
};

// Helper to broadcast messages to a room
const broadcastToRoom = (roomId: number, payload: any, exclude?: WebSocket) => {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const text = JSON.stringify(payload);
  for (const client of clients) {
    if (client !== exclude) {
      try { client.send(text); } catch (e) { /* ignore */ }
    }
  }
};

// WebSocket endpoint
app.get("/ws", upgradeWebSocket((c) => {
  const { roomId, userId } = getWsParams(c);

  return {
    onOpen(ws) {
      if (!roomId || !userId) {
        ws.close(1008, "missing roomId or userId");
        return;
      }

      let set = rooms.get(roomId);
      if (!set) {
        set = new Set();
        rooms.set(roomId, set);
      }
      set.add(ws);
      wsMeta.set(ws, { userId, roomId });

      broadcastToRoom(roomId, { type: "user_join", userId });
      console.log(`WS: user ${userId} joined room ${roomId}`);
    },
    
    async onMessage(event, ws) {
      try {
        const meta = wsMeta.get(ws);
        if (!meta) return;
        const { roomId, userId } = meta;
        const data = JSON.parse(String(event.data));

        if (data.type === "message" && typeof data.content === "string") {
          const payload = {
            type: "message",
            userId,
            content: data.content,
            timestamp: Date.now(),
          };

          // Save message to DB
          try {
            await prismaClient.message.create({
              data: {
                content: data.content,
                room_id: roomId,
                sent_by: userId,
              },
            });
          } catch (e) {
            console.error("Failed to persist message:", e);
          }

          broadcastToRoom(roomId, payload);
        }
      } catch (e) {
        console.error("ws onMessage error", e);
      }
    },
    
    onClose(ws) {
      const meta = wsMeta.get(ws);
      if (!meta) return;
      const { roomId, userId } = meta;
      wsMeta.delete(ws);

      const set = rooms.get(roomId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(roomId);
      }

      broadcastToRoom(roomId, { type: "user_leave", userId });
      console.log(`WS: user ${userId} left room ${roomId}`);
    }
  }
}));