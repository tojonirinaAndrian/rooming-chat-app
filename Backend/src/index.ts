import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fire } from "hono/service-worker";
import http from "http";
import { contextStorage, getContext } from "hono/context-storage";
import { setCookie } from 'hono/cookie';
import { getCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { cors } from "hono/cors";
import { prismaClient } from './prismaClient';
import dotenv from "dotenv";
import { Server as SocketIoServer } from "socket.io";

dotenv.config();
const FRONT_URL: string = String(process.env.FRONT_URL);
const PORT: string = String(process.env.PORT);
const SESSION_TTL: number = Number(process.env.SESSION_TTL);
const COOKIE_NAME: string = 'sessionId';

type Env = {
  Variables: {
    user: {
      name: string;
      id: number;
      email: string;
      password: string;
      joined_rooms: number[];
    },
    session: {
      sessionId: number;
      userId: number;
      startedAt: Date;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
      isRevoked: boolean;
    }
  }
}

const getUser = () => {
  return getContext<Env>().var.user
};
const getSession = () => {
  return getContext<Env>().var.session
}

const app = new Hono<Env>();

//contexing
app.use(contextStorage())

// CORS
app.use('*', cors({
  origin: FRONT_URL,
  allowMethods: ['GET', 'POST', 'DELETE', 'PUT'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// auth middlware
app.use("*", async (c, next) => {
  const sessionId = Number(getCookie(c, COOKIE_NAME));
  console.log("sessionId from cookie : " + sessionId);
  if (!sessionId || isNaN(sessionId)) return await next();
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
      console.log("expired");
      return await next();
    } else {
      c.set("session", session);
      const user = await prismaClient.user.findUnique({
        where: { id: Number(session.userId) }
      });
      if (user) {
        c.set("user", user);
      }
      return await next();
    }
  }
})

// session creation function
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
      startedAt: new Date(),
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

// API REST :
app.get("/", (c) => c.text("Running"));
// login
app.post("/api/login", async (c) => {
  console.log("logging IN !");
  if (getSession() && getUser()) {
    return c.text("loggedIn");
  }
  const body: {
    email: string, password: string
  } = await c.req.json();
  try {
    const userIfExists = await prismaClient.user.findUnique({
      where: {
        email: body.email
      }
    });
    if (userIfExists) {
      const isPasswordCorrect = await bcrypt.compare(body.password, userIfExists.password);
      if (!isPasswordCorrect) {
        return c.text("incorrectPassword");
      }
      const ipAddress = c.req.header("x-forwarded-for") || (c.req as any).conn?.remoteAddress || undefined;
      const userAgent = c.req.header('user-agent') || undefined;
      try {
        const userSession: {
          sessionId: number, expiresAt: Date
        } = await createSession(userIfExists.id, ipAddress, userAgent);
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
  } catch (error) {
    console.log(error);
  }
});

// signup
app.post("/api/signup", async (c) => {
  if (getSession() && getUser()) {
    return c.text("loggedIn");
  };
  const body: {
    email: string, password: string, name: string
  } = await c.req.json();
  try {
    const userIfExists = await prismaClient.user.findUnique({
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
      } = await createSession(createdUser.id, ipAddress, userAgent);

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
  } catch (error) {
    console.log(error);
  }
})


// getCurrentUser
app.get("/api/getCurrentUser", async (c) => {
  if (getUser() && getSession()) {
    return c.json({
      user: {
        name: getUser().name,
        email: getUser().email,
        id: getUser().id
      }
    })
  } else {
    return c.text("notLoggedIn");
  }
})

// logout
app.get("/api/logout", async (c) => {
  const session = getSession();
  if (session) {
    try {
      await prismaClient.session.update({
        where: { sessionId: session.sessionId }, data: {
          isRevoked: true
        }
      });
      return c.json({ message: "logoutSuccessful" });
    } catch (error) {
      return c.json({ error, message: "error" });
    }
  };
  return c.json({ error: "error while logging out, session seems to not exist", message: "error" });
})

// create_room
app.post("/api/createRoom", async (c) => {
  const body: {
    room_name: string,
  } = await c.req.json();
  if (!(getUser() && getSession())) {
    return c.json({ message: "userNotLoggedIn" });
  }
  const user_id: number = getUser().id;
  const room_name: string = body.room_name;
  const created_by: number = Number(user_id);

  try {
    const checkIfRoomNameExists = await prismaClient.room.findFirst({
      where: {
        room_name
      }
    })
    if (checkIfRoomNameExists) {
      return c.json({ message: "roomNameAlreadyExists" });
    }
    const createdRoom = await prismaClient.room.create({
      data: {
        room_name,
        created_by,
      }
    });
    return c.json({
      createdRoom: {
        room_name: createdRoom.room_name,
        room_id: createdRoom.id
      },
      message: "success"
    });

  } catch (e) {
    return c.json({
      error: e,
      message: "error"
    });
  }
});

// join room
app.get("/api/joinRoom/:room_name/:room_id", async (c) => {
  const room_name: string = c.req.param("room_name");
  const room_id: number = Number(c.req.param("room_id"));

  if (!(getUser() && getSession())) {
    return c.json({ message: "userNotLoggedIn" });
  }
  const user_id = getUser().id;

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
        }, data: {
          gueists_ids: [...new_guests_ids]
        }
      });
      const updatedJoinedRoomsTable: number[] = getUser().joined_rooms;
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
      return c.json({ message: "room_not_found" });
    }

  } catch (e) {
    return c.json({ error: e });
  }
});

// user's rooms
app.get("/api/get_rooms/:where", async (c) => {
  if (!(getUser() && getSession())) {
    return c.json({ message: "userNotLoggedIn" });
  }
  const user_id = getUser().id;
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
    } catch (e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }
  //joined by current user
  else if (where === "joined") {
    try {
      const userJoinedRooms: number[] = getUser().joined_rooms;
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
    } catch (e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }

  // all
  else if (where === "all") {
    try {
      const userJoinedRooms: number[] = getUser().joined_rooms;
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

    } catch (e) {
      return c.json({
        error: e,
        message: "error"
      })
    }
  }
})

// socket.Io
const io = new SocketIoServer({
  cors: {
    origin: FRONT_URL,
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
  }
});

io.on("connection", async(socket) => {
  console.log("user connected ", socket.id);
   // Joining private room
  socket.on("join-all-rooms", () => {
    console.log("joining all", socket.id);
  })
  socket.on("join-room", ({ roomName, roomId, currentUser }: {
    roomName: string,
    roomId: number,
    currentUser: {
      name: string,
      email: string,
      id: number
    }
  }) => {
    console.log("joining private", socket.id);
    // socket.join(`${roomId}`);
    // socket.data.currentUser = currentUser;
    // console.log(`${currentUser.name} just joined room ${roomName}-${roomId}`);
    // io.to(`${roomId}`).emit("new-user-joined", currentUser);
  });

  socket.on("send-message", ({ roomName, roomId, message, currentUser }: {
    roomId: number,
    message: string,
    currentUser: {
      name: string,
      email: string,
      id: number,
    },
    roomName: string
  }) => {
    console.log("sending-message", socket.id);
    // const sender = socket.data.currentUser || currentUser;
    // io.to(`${roomId}`).emit("receive-message", { sender, message });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  })
})

// fire(app);
// export default app;
// ORRR using THIS for nodeJs server
serve(app, (info) => {
  console.log("listening to port ", info.port)
});