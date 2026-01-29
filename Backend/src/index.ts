import { Hono } from 'hono';
import dotenv from "dotenv";
import { fire } from "hono/service-worker";
import {cors} from "hono/cors";
import { serveStatic } from "hono/bun";
import { upgradeWebSocket } from 'hono/bun';
import { prismaClient } from './prismaClient';

const app = new Hono();
const FRONT_URL: string = String(process.env.FRONT_URL);

app.get('/', (c) => {
  return c.text('Hello Hono!')
});

// websocket
app.get("/ws", upgradeWebSocket((c) => {
  return {
    onOpen(ws) {
      console.log("WS Connected");
    }, 
    onMessage(event, ws) {
      console.log("Received : ", event.data);
      ws.send(String(event.data));
    },
    onClose() {
      console.log("WS disconnected");
    }
  }
}));

// CORS
app.use('*', cors({
  origin: FRONT_URL,
  allowMethods:['GET', 'POST', 'DELETE', 'PUT'],
  allowHeaders:['Content-Type', 'Authorization'],
  credentials: true
}));

// REST API
// create_room
app.post("/api/createRoom", async (c) => {
  const body: {
    room_name: string,
    user_id: string,
    ws: WebSocket
  } = await c.req.json();
  const room_name: string = body.room_name;
  const created_by: string = body.user_id;
  const user_ws: WebSocket = body.ws;

  return c.text("Creating room");
});


fire(app);

export default app;
