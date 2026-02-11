import io from "socket.io-client";

const socketConnection = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
    withCredentials: true,
    transports: ["websocket"],
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
});

export default socketConnection;