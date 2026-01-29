import { Hono } from 'hono';
import { fire } from "hono/service-worker";
import {cors} from "hono/cors";
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
    // ws: WebSocket
  } = await c.req.json();
  const room_name: string = body.room_name;
  const created_by: string = body.user_id;
  // const user_ws: WebSocket = body.ws;
  try {
    const createdRoom = await prismaClient.room.create({
      data: {
        room_name,
        created_by,
        people_ids: [created_by]
      }
    });
    // const roomId = createdRoom.id;
    return c.json ({
      createdRoom,
      message: "success"
    });
  } catch {
    return c.text("error")
  }
});

app.post("/api/joinRoom/:room_name/:room_id", async (c) => {
  const room_name: string = c.req.param("room_name") as string;
  const room_id: string = c.req.param("room_id");
  const body: {
    // user_wb: WebSocket,
    user_id: string
  } = await c.req.json();
  // const user_ws = body.user_wb;
  const user_id = body.user_id;
  try {
    const currentRoom = await prismaClient.room.findFirst({
      where: {
        id: (room_id), room_name
      }
    });
    if (currentRoom) {
      const new_people_ids: string[] = currentRoom.people_ids;
      new_people_ids.push(user_id);
      const updatedRoom = await prismaClient.room.update({
        where: {
          room_name,
          id: (room_id)
        }, data : {
          people_ids: [...new_people_ids]
        }
      });
      return c.json({
        updatedRoom,
        message: "success"
      });
    } else {
      return c.text("room_not_found");
    }  
  } catch {
    return c.text("error");
  }
})

app.get("/api/createRandomUsers", async (c) => {
  try {
    await prismaClient.user.deleteMany();
    const new_users: {
      name: string, email: string,id: string
    }[] = [{
      name: "User1", email: "user1@email.com", id: "1sf"
    }, {
      name: "User2", email: "user2@email.com", id: "2fs"
    }, {
      name: "User3", email: "user3@email.com", id: "3fs"
    }];
    
    const data = await prismaClient.user.createMany({
      data: [...new_users]
    });
    
    return c.text("success");
  } catch(e) {
    return c.json({error : e});
  }
});

app.get("/api/getCurrentUsers", async (c) => {
  const users = await prismaClient.user.findMany();
  if (users) return c.json(users)
  else return c.text("error")
})

fire(app);

export default app;
