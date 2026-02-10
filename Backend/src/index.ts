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
import { setCookie } from 'hono/cookie';
import { getCookie, deleteCookie } from 'hono/cookie';
import http from "http";

dotenv.config();

const app = new Hono();

const FRONT_URL: string = String(process.env.FRONT_URL);
const PORT: string = String(process.env.PORT);
const SESSION_TTL: number = Number(process.env.SESSION_TTL);
const COOKIE_NAME: string = 'sessionId';

// for http server
const server = http.createServer();

// attaching hono to HTTP
serve({
  fetch: app.fetch,
  port: 3000,
  createServer: () => server
});

// CORS
app.use('*', cors({
  origin: FRONT_URL,
  allowMethods:['GET', 'POST', 'DELETE', 'PUT'],
  allowHeaders:['Content-Type', 'Authorization'],
  credentials: true
}));

// middleware that would run before every api req :
app.use("*", async (c, next) => {
    
    const sessionId = Number(getCookie(c, COOKIE_NAME));
    console.log("sessionId from cookie : " + sessionId);
    if (!sessionId) return await next();
    else {
      // finding it in the DB
      console.log("sessionId : " + sessionId);
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
const cookieOptions = (maxAgeSeconds: number) => {
  const secure: boolean = (process.env.NODE_ENV === 'production');
  return {
    httpOnly: true,
    sameSite: 'Strict' as "Strict",
    path: "/",
    maxAge: maxAgeSeconds.toString(),
    secure: secure,
    domain: process.env.COOKIE_DOMAIN || undefined,
    expires: new Date(Date.now() + (SESSION_TTL * 1000))
  }
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
    });
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
        const generatedCookiesOptions = cookieOptions(SESSION_TTL);

        setCookie(c, COOKIE_NAME, String(userSession.sessionId), {
          httpOnly: generatedCookiesOptions.httpOnly,
          sameSite: generatedCookiesOptions.sameSite,
          path: generatedCookiesOptions.path,
          maxAge: Number(generatedCookiesOptions.maxAge),
          secure: generatedCookiesOptions.secure,
          domain: generatedCookiesOptions.domain,
          expires: generatedCookiesOptions.expires
        });
        
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
app.post("/api/signup", async (c) => {
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

      const generatedCookiesOptions = cookieOptions(SESSION_TTL);
      setCookie(c, COOKIE_NAME, String(userSession.sessionId), {
        httpOnly: generatedCookiesOptions.httpOnly,
        sameSite: generatedCookiesOptions.sameSite,
        path: generatedCookiesOptions.path,
        maxAge: Number(generatedCookiesOptions.maxAge),
        secure: generatedCookiesOptions.secure,
        domain: generatedCookiesOptions.domain,
        expires: generatedCookiesOptions.expires
      });

      return c.text("doneSigningUp");
    } catch (error) {
      console.log(error)
    }
    return c.text("couldntSignUp");
  } catch(error) {
    console.log(error);
  }
})

// getCurrentUser
app.get("/api/getCurrentUser", async (c) => {
  if ((c as any).user && (c as any).session) {
    return c.json({user: {
      name: (c as any).user.name,
      email: (c as any).user.email,
      id: (c as any).user.id
    }})
  } else {
    return c.text("notLoggedIn");
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
      return c.json({error, message: "error"});
    }
  };
  return c.json({error: "error while logging out, session seems to not exist", message: "error"});
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
      }
    });
    return c.json ({
      createdRoom: {
        room_name: createdRoom.room_name,
        room_id: createdRoom.id
      },
      message: "success"
    });

  } catch(e) {
    return c.json({error : e,
      message: "error"
    });
  }
});

// join room
app.get("/api/joinRoom/:room_name/:room_id", async (c) => {
  const room_name: string = c.req.param("room_name");
  const room_id: number = Number(c.req.param("room_id"));
  
  if (!((c as any).user && (c as any).session)) {
    return c.json({ message : "userNotLoggedIn"});
  }
  const user_id = (c as any).user.id;

  try {
    const currentRoom = await prismaClient.room.findFirst({
      where: {
        id: Number(room_id), 
        room_name
      }
    });

    if (currentRoom) {
      //checks if the current is the creator
      if (currentRoom.created_by === user_id) {
        console.log(currentRoom.created_by);
        console.log(user_id);
        return c.json({
          message: "own_room"
        });
      }
      const new_guests_ids: number[] = currentRoom.gueists_ids;
      new_guests_ids.push(Number(user_id));
      const updatedRoom = await prismaClient.room.update({
        where: {
          room_name,
        }, data : {
          gueists_ids: [...new_guests_ids]
        }
      });
      const updatedJoinedRoomsTable: number[] = (c as any).user.joined_rooms;
      updatedJoinedRoomsTable.push(updatedRoom.id);
      const updatedNewJoinedUser = await prismaClient.user.update({
        where: {
          id: user_id
        }, data: {
          joined_rooms: [...updatedJoinedRoomsTable]
        }
      });
      return c.json({
        updatedRoom,
        message: "success"
      });
    } else {
      return c.json({message : "room_not_found"});
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
});

// user's rooms
app.get("/api/get_rooms/:where", async (c) => {
  if (!((c as any).user && (c as any).session)) {
    return c.json({ message : "userNotLoggedIn"});
  }
  const user_id = (c as any).user.id;
  const where: "all" | "created" | "joined" = c.req.param("where") as "all" | "created" | "joined";

  //created by current user
  if (where === "created") {
    try {
      const rooms = await prismaClient.room.findMany({
        where: {
          created_by: user_id
        }
      });
      return c.json({
        rooms: rooms,
        message: "success"
      });
    } catch(e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }
  //joined by current user
  else if (where === "joined") {
    try {
      const userJoinedRooms: number[] = (c as any).user.joined_rooms;
      const orTable: {}[] = userJoinedRooms.map((room_id) => {
        return {
          id: room_id
        }
      })
      const rooms = await prismaClient.room.findMany({
        where: {
          OR: orTable
        }
      });
      return c.json({
        rooms: rooms,
        message: "success"
      });
    } catch(e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }

  // all
  else if (where === "all") {
    try {
      const userJoinedRooms: number[] = (c as any).user.joined_rooms;
      const orTable: {
        id: number
      }[] = userJoinedRooms.map((room_id) => {
        return {
          id: room_id
        }
      });
      const joinedRooms = await prismaClient.room.findMany({
        where: {
          OR: orTable
        }
      });
      const createdRooms = await prismaClient.room.findMany({
        where: {
          created_by: user_id
        }
      });

      const rooms: {
        id: number;
        gueists_ids: number[];
        created_at: Date;
        created_by: number;
        room_name: string;
      }[] = [];

      joinedRooms.map((room) => rooms.push(room));
      createdRooms.map((room) => rooms.push(room));

      return c.json({
        rooms: rooms,
        message: "success"
      });

    } catch(e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }
})


// use this for normal firing
// fire(app);

// // for http server
// const server = http.createServer();

// // attaching hono to HTTP
// serve({
//   fetch: app.fetch,
//   port: 3000,
//   createServer: () => server
// });

// Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: FRONT_URL,
    methods: ['GET', 'POST']
  }
});

// Socket Events
io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  // Joining private room
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;
    console.log(`${username} joined room ${roomId}`);
  });

  socket.on("send-message", ({ roomId, message }) => {
    const sender = socket.data.username || "unknown";
    io.to(roomId).emit("receive-message", {sender, message});
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  })
})

console.log("Server running on http://localhost:3000");

export default app;