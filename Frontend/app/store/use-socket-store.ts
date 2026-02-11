" use client ";

import { create } from "zustand";
import type { Socket } from "socket.io-client";
import { getSocketConnection } from "../socket/socket";

interface SocketState {
    socket: Socket | null,
    connected: boolean,
    connect: (token?: string) => void,
    disconnect: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
    socket: null,
    connected: false,

    connect: (token) => {
        const socket = getSocketConnection();
        if (token) socket.auth = { token };
        socket.connect();

        socket.on("connect", () => {
            set({ connected: true, socket: socket })
        });
        socket.on("disconnect", () => {
            set({ connected: false })
        });
    },

    disconnect: () => {
        const socket = get().socket;
        if (socket) {
            socket.disconnect();
            set({ connected: false });
        }
    }
}));