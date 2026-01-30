import { Hono } from 'hono';
import { fire } from "hono/service-worker";
import { cors } from "hono/cors";
import { prismaClient } from './prismaClient';
import { serve } from '@hono/node-server';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from "dotenv";
import bcrypt from 'bcryptjs';

dotenv.config();

const app = new Hono();
const FRONT_URL: string = String(process.env.FRONT_URL);
console.log(FRONT_URL);
const PORT: string = String(process.env.PORT);
const SESSION_TTL: number = Number(process.env.SESSION_TTL);
const COOKIE_NAME: string = 'sessionId';

// CORS
app.use('*', cors({
  origin: FRONT_URL,
  allowMethods:['GET', 'POST', 'DELETE', 'PUT'],
  allowHeaders:['Content-Type', 'Authorization'],
  credentials: true
}));

// REST API
// test
app.get('/', async(c) => {
  console.log("hello");
  return c.json({message: 'Hello Hono!'});
});


fire(app);

export default app;