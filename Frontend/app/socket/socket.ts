'use client'
import { io, Socket } from "socket.io-client";

let socketConnection: Socket | null = null;
export const getSocketConnection = () => {
    if (!socketConnection) socketConnection = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
        withCredentials: true,
        transports: ["websocket"],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
    });
    return socketConnection
}