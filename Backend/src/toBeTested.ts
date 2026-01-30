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

// middleware that would run before every api req :
app.use("*", async (c, next) => {
    const cookieHeader: string = c.req.header("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader
      .split(";")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map(pair => {
      const [k, ...v] = pair.split('=')
      return [k, decodeURIComponent(v.join('='))]
      })
    );
    // checking the sessionId from the cookie
    const sessionId = Number((cookies as Record<string, string>)[COOKIE_NAME])
    if (!sessionId) return await next();
    else {
      // finding it in the DB
      const session = await prismaClient.session.findUnique({
          where: {
              sessionId
          }
      })
      if (!session) return await next();
      if (session.isRevoked) return await next(); // continues if isRevoked
      if (session.expiresAt < new Date()) {
      try {
          // revoke it if the date is expired
          await prismaClient.session.update({
              where: { 
                  sessionId 
              }, data: { 
                  isRevoked: true 
              }
          });
      } catch (e) {
        console.log(e)
      }
      return await next();
      } else {
      // adding new items to hono context "c"
      (c as any).session = session;
      const user = await prismaClient.user.findUnique ({
          where: { id: Number(session.userId) }
      });
      (c as any).user = user;
      return await next();
      }
  }
})

// hono serving as node-server
const server = serve({
  fetch: app.fetch,
  port: Number(PORT),
}, (info) => {
  console.log(`Server is running at http://${info.address}:${info.port}`);
});

// Socket.IO instance attached to the HTTP server (Frontend will connect to this)
const io = new SocketIOServer(server, {
  cors: {
    origin: FRONT_URL,
    methods: ["GET", "POST", "DELETE", "PUT"]
  }
});

// Redis client for pub/sub
const redisConfig = async () => {
  const pubClient = createClient({
    url: 'redis://localhost:6379'
  });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
};
redisConfig();

// socket.io connection
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.on("join_room", (room) => {
    socket.join(room);
  });
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// session creation
const createSession = async (
  userId: number, 
  ipAddress: string | undefined, 
  userAgent: string | undefined
) => {
  const expiresAt = new Date(Date.now() + (SESSION_TTL * 1000));
  const sessionCreated = await prismaClient.session.create({
    data: {
      userId,
      expiresAt,
      ipAddress,
      userAgent,
      startedAt: new Date (),
      // isRevoked: false
    }
  });
  return {
    sessionId: sessionCreated.sessionId as number,
    expiresAt: expiresAt as Date,
  }
}

// returning cookieOptions string
const cookieOptions = (maxAgeSeconds: number): string => {
  const secure: string = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `HttpOnly; ${secure}SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`
}

// deleting all expired sessions
const deleteAllExpiredSessions = async () => {
  try {
    await prismaClient.session.deleteMany({
      where: { 
        expiresAt: { 
          lt: new Date() 
        }
      }
    }) 
  } catch (error) {
    console.log(error)
  }
}

// REST API
// test
app.get('/', async(c) => {
  console.log("hello");
  return c.text('Hello Hono!');
});

// login
app.post("/api/login", async (c) => {
  if ((c as any).session && (c as any).user) {
    return c.text("loggedIn");
  }
  const body: {
    email: string, password: string
  } = await c.req.json();
  try {
    const userIfExists = await prismaClient.user.findUnique ({
      where: {
        email: body.email
      }
    })
    if (userIfExists) {
      const isPasswordCorrect = await bcrypt.compare (body.password, userIfExists.password);
      if (!isPasswordCorrect) {
        return c.text("incorrectPassword");
      }
      const ipAddress = c.req.header("x-forwarded-for") || (c.req as any).conn?.remoteAddress || undefined;
      const userAgent = c.req.header('user-agent') || undefined;
      try {
        const userSession: {
          sessionId: number, expiresAt: Date
        } = await createSession (userIfExists.id, ipAddress, userAgent);
        c.header("Set-Cookie", `${COOKIE_NAME}) = ${userSession.sessionId}; ${cookieOptions (SESSION_TTL)}`);
        return c.text("doneLoggingIn");
      } catch (error) {
        return c.text("errorWhenCreatingSession");
      }
    }
    return c.text("emailDoesNotExist");
  } catch(error) {
    console.log(error);
  }
})

// signup
app.post("/api/singup", async (c) => {
  if ((c as any).session && (c as any).user) {
    return c.text("loggedIn");
  };
  const body: {
    email: string, password: string, name: string
  } = await c.req.json();
  try {
    const userIfExists = await prismaClient.user.findUnique ({
      where: {
        email: body.email
      }
    });
    if (userIfExists) {
      return c.text("emailRegistred");
    };
    const hashedPassword = await bcrypt.hash(body.password, 10);
    const createdUser = await prismaClient.user.create({
      data: {
        email: body.email, password: hashedPassword, name: body.name
      }
    });
    const ipAddress = c.req.header("x-forwarded-for") || (c.req as any).conn?.remoteAddress || undefined;
    const userAgent = c.req.header('user-agent') || undefined;
    try {
      const userSession: {
        sessionId: number, expiresAt: Date
      } = await createSession (createdUser.id, ipAddress, userAgent);
      c.header("Set-Cookie", `${COOKIE_NAME}) = ${userSession.sessionId}; ${cookieOptions (SESSION_TTL)}`);
      return c.text("doneSigninUp");
    } catch (error) {
      console.log(error)
    }
    return c.text("emailDoesNotExist");
  } catch(error) {
    console.log(error);
  }
})

// logout
app.get("/api/logout", async (c) => {
  const session = (c as any).session;
  if (session) {
    try {
      await prismaClient.session.update({
        where: {sessionId: session.sessionId}, data: {
          isRevoked: true
        }
      });
      return c.json({message: "logoutSuccessful"});
    } catch (error) {
      return c.json({error});
    }
  };
  return c.json({error: "error while logging out, session seems to not exist"});
})

// create_room
app.post("/api/createRoom", async (c) => {
  const body: {
    room_name: string,
  } = await c.req.json();
  if (!((c as any).user && (c as any).session)) {
    return c.json({ message : "userNotLoggedIn"});
  }
  const user_id: number = (c as any).user.id;
  const room_name: string = body.room_name;
  const created_by: number = Number(user_id);
  
  try {
    const checkIfRoomNameExists = await prismaClient.room.findFirst({
      where: {
        room_name
      } 
    })
    if (checkIfRoomNameExists) {
      return c.json({message: "roomNameAlreadyExists"});
    }
    const createdRoom = await prismaClient.room.create({
      data: {
        room_name,
        created_by,
        people_ids: [created_by]
      }
    });
    return c.json ({
      createdRoom,
      message: "success"
    });

  } catch(e) {
    return c.json({error : e});
  }
});

// join room
app.get("/api/joinRoom/:room_name/:room_id", async (c) => {
  const room_name: string = c.req.param("room_name");
  const room_id: string = c.req.param("room_id");
  
  if (!((c as any).user && (c as any).session)) {
    return c.json({ message : "userNotLoggedIn"});
  }
  const user_id = (c as any).user.id;

  try {
    const currentRoom = await prismaClient.room.findFirst({
      where: {
        id: Number(room_id), room_name
      }
    });

    if (currentRoom) {
      const new_people_ids: number[] = currentRoom.people_ids;
      new_people_ids.push(Number(user_id));
      const updatedRoom = await prismaClient.room.update({
        where: {
          room_name,
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

  } catch(e) {
    return c.json({error : e});
  }
});

// test user creation
app.get("/api/createRandomUsers", async (c) => {
  try {
    await prismaClient.user.deleteMany();
    const new_users: {
      name: string, email: string, password: string
    }[] = [{
      name: "User1", email: "user1@email.com", password: await bcrypt.hash("passPass1!", 10)
    }, {
      name: "User2", email: "user2@email.com", password: await bcrypt.hash("passPass2!", 10)
    }, {
      name: "User3", email: "user3@email.com", password: await bcrypt.hash("passPass3!", 10)
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
