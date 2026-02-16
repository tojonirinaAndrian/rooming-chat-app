import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fire } from "hono/service-worker";
import http, { createServer } from "http";
import { contextStorage, getContext } from "hono/context-storage";
import { setCookie } from 'hono/cookie';
import { getCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { cors } from "hono/cors";
import { prismaClient } from './prismaClient';
import dotenv from "dotenv";
import { Socket, Server as SocketIoServer } from "socket.io";
import cookie from "cookie";

dotenv.config();
const FRONT_URL: string = String(process.env.FRONT_URL);
const PORT: string = String(process.env.PORT);
const SESSION_TTL: number = Number(process.env.SESSION_TTL);
const COOKIE_NAME: string = 'sessionId';

type messageFromSocket = {
  message: string,
  roomId: number,
  sender: {
    name: string,
    id: number
  }
};

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
      deleteCookie(c, COOKIE_NAME);
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
      room: createdRoom,
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
        room: updatedRoom,
        message: "success"
      });
    } else {
      return c.json({ message: "room_not_found" });
    }

  } catch (e) {
    return c.json({ error: e });
  }
});

// save message to the db
const saveMessage = async (messageToSaveAndSocketInstance: {
  roomId: number,
  message: string,
  socket: Socket
}) => {
  const user = messageToSaveAndSocketInstance.socket.data.user as {
    id: number;
    name: string;
    email: string;
    password: string;
    joined_rooms: number[];
  };
  try {
    await prismaClient.message.create({
      data: {
        content: messageToSaveAndSocketInstance.message,
        sent_by_id: user.id,
        sent_by_name: user.name,
        room_id: messageToSaveAndSocketInstance.roomId,
      }
    })
    return "success";
  } catch (e) {
    console.log(e);
    return "error";
  }
}

// room's messages
app.get("/api/get_messages/:room_id", async (c) => {
  const room_id: number = Number(c.req.param("room_id"));
  try {
    const messages = await prismaClient.message.findMany({
      where: {
        room_id
      }
    });
    const messagesTable: messageFromSocket[] = messages.map((message) => {
      return {
        message: message.content,
        roomId: message.room_id,
        sender: {
          name: message.sent_by_name,
          id: message.sent_by_id
        }
      }
    });
    return c.json({
      message: "success",
      messagesTable: [...messagesTable]
    });
  } catch (e) {
    console.log("error", e);
    return c.json({ message: "error", "error": e });
  }
})

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

      const rooms: {
        id: number;
        gueists_ids: number[];
        created_at: Date;
        created_by: number;
        room_name: string;
      }[] = await prismaClient.room.findMany({
        where: {
          OR: [
            { id: { in: userJoinedRooms } },
            {
              created_by: user_id
            }
          ]
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
})

app.get("/api/leave_room/:room_id", async (c) => {
  console.log("leaving room");
  try {
    const room_id = Number(c.req.param("room_id"));
    const user_id = Number(getUser().id);
    const current_room = await prismaClient.room.findUnique({ where: { id: room_id } });
    if (current_room) {
      const new_guests: number[] = [];
      current_room.gueists_ids.map((guest_id) => {
        if (guest_id !== user_id) {
          new_guests.push(guest_id)
        }
      });
      await prismaClient.room.update({
        where: { id: room_id },
        data: {
          gueists_ids: [...new_guests]
        }
      });
    } else {
      return c.json({
        message: "error"
      })
    }
    return c.json({
      message: "success"
    });
  } catch (e) {
    return c.json({
      message: "error",
      error: e
    });
  }
});

app.get("/api/delete_room/:room_id", async (c) => {
  console.log("deleting room");
  try {
    const room_id = Number(c.req.param("room_id"));
    const user_id = Number(getUser().id);
    const current_room = await prismaClient.room.findUnique({ where: { id: room_id } });
    if (current_room) {
      await prismaClient.room.delete({
        where: {
          id: room_id, created_by: user_id
        }
      });
    } else {
      return c.json({
        message: "error"
      })
    }
    return c.json({
      message: "success"
    });
  } catch (e) {
    return c.json({
      message: "error",
      error: e
    });
  }
})

const server = serve(app, (info) => {
  console.log("listening to port ", info.port)
});

// socket.Io
const io = new SocketIoServer(server, {
  cors: {
    origin: FRONT_URL,
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
  }
});

io.use(async (socket, next) => {
  const cookiesString = socket.handshake.headers.cookie;
  const cookies = cookie.parse(cookiesString || '');
  const sessionId = Number(cookies[COOKIE_NAME]);
  console.log("sessionId from cookie : " + sessionId);

  if (!sessionId || isNaN(sessionId)) {
    return next(new Error("Unauthorized"));
  }

  try {
    const session = await prismaClient.session.findUnique({
      where: { sessionId }
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return next(new Error("Invalid session"));
    }

    const user = await prismaClient.user.findUnique({
      where: { id: session.userId }
    });

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.data.user = user;
    next();
  } catch (error) {
    console.log("Auth error:", error);
    next(new Error("Authentication failed"));
  }
});

io.on("connection", async (socket) => {
  console.log("user connected ", socket.id);
  const currentUser = socket.data.user;
  // Joining private room
  socket.on("join-all-rooms", async () => {
    console.log("joining all", socket.id);

    const userJoinedRooms: number[] = socket.data.user.joined_rooms;
    try {
      const rooms: {
        id: number;
        gueists_ids: number[];
        created_at: Date;
        created_by: number;
        room_name: string;
      }[] = await prismaClient.room.findMany({
        where: {
          OR: [
            { id: { in: userJoinedRooms } },
            { created_by: currentUser.id }
          ]
        }
      });
      console.log("tryna join all rooms");
      rooms.forEach((room) => {
        socket.join(room.id.toString());
      });
      console.log("joined all rooms");
    } catch (e) {
      console.log("error while tryna join all current rooms : ", e)
    }
  });

  socket.on("leave-room", ({ roomId }: {
    roomId: number
  }) => {
    console.log("leaving room from socket", socket.id);
    socket.leave(`${roomId}`);
    io.to(`${roomId}`).emit("user-leaved", {user: socket.data.user});
  });

  socket.on("room-deleted", ({ roomId }: {
    roomId: number
  }) => {
    console.log("room deleted by owner", socket.id);
    socket.leave(`${roomId}`);
    io.to(`${roomId}`).emit("user-leaved", {user: socket.data.user});
  });

  socket.on("join-room", ({ roomId }: {
    roomId: number,
  }) => {
    console.log("joining private", socket.id);
    socket.join(`${roomId}`);
    console.log(`${socket.data.user.name} just joined room ${roomId}`);
    io.to(`${roomId}`).emit("new-user-joined", {user: socket.data.user});
  });

  socket.on("send-message", async ({ roomId, message }: {
    roomId: number,
    message: string,
  }) => {
    console.log("sending-message", socket.id, " message: ", message, " from : ", socket.data.user.name);
    const sender = socket.data.user;
    console.log("sending message back to roomId : ", roomId);
    io.to(`${roomId}`).emit("receive-message", { sender, roomId, message });
    const response: "error" | "success" = await saveMessage({
      roomId, message, socket
    })
    console.log("saving in the db : ", response);

  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  })
})

// fire(app);
// export default app;
// ORRR using THIS for nodeJs server
// THE ONE BEFORE THE SOCKET.IO SERVING
