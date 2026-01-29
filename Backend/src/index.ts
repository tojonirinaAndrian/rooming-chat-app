import { Hono } from 'hono';
import dotenv from "dotenv";
import { fire } from "hono/service-worker";
import {cors} from "hono/cors";
import { serveStatic } from "hono/bun";

const app = new Hono();
const FRONT_URL: string = String(process.env.FRONT_URL);

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// CORS
app.use('*', cors({
  origin: FRONT_URL,
  allowMethods:['GET', 'POST', 'DELETE', 'PUT'],
  allowHeaders:['Content-Type', 'Authorization'],
  credentials: true
}))

app.get("/api/createRoom", (c) => {
  return c.text("Creating room");
})

fire(app);
export default app;
