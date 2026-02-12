'use client'
import { io, Socket } from "socket.io-client";

let socketConnection: Socket | null = null;
export const getSocketConnection = () => {
    if (!socketConnection) socketConnection = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
        withCredentials: true,
        transports: ["websocket"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
    });
    return socketConnection
}