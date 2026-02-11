import io from "socket.io-client";

export const socketConnection = io(process.env.NEXT_PUBLIC_BACKEND_URL)
