// server
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
const app = new Hono();

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

const server = serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running: http://${info.address}:${info.port}`);
  }
);

const ioServer = new Server(server as HttpServer, {
  path: '/ws',
  serveClient: false,
});
ioServer.on("error", (err) => {
  console.log(err)
})

ioServer.on("connection", (socket) => {
  console.log("client connected")
})

setInterval(() => {
  ioServer.emit("hello", "world")
},1000);

///////////////////////////////////////////////////////////////////

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

const app = new Hono();

// Route HTTP classique pour l'historique (Hono est super rapide ici)
app.get('/rooms/:code/messages', async (c) => {
  const code = c.req.param('code');
  // Logique PostgreSQL ici...
  return c.json([{ author: 'Système', message: `Bienvenue dans la room ${code}` }]);
});

const port = 4000;
const server = serve({
  fetch: app.fetch,
  port
});

// Création de l'instance Socket.io attachée au serveur HTTP
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configuration Redis (Identique à Express)
const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

io.on('connection', (socket) => {
  console.log('Connecté à Hono:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('send_message', async (data) => {
    // 1. Save to PG
    // 2. Broadcast
    io.to(data.room).emit('receive_message', data);
  });
});

console.log(`Serveur Hono lancé sur le port ${port}`);