'use client';

import { useEffect, useState, useTransition, useCallback } from "react";
import HeaderComponent from "../components/header";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import axiosInstance from "../axios/axiosInstance";
import { useSocketStore } from "../store/use-socket-store";

// ============================================================================
// TYPES
// ============================================================================

type room = {
    room_name: string,
    id: number,
    created_at: Date,
    created_by: number,
    people_ids: number[]
}

type messageFromDb = {
    id: number,
    content: string,
    sent_by_id: number,
    room_id: number,
    created_at: Date,
    sent_by_name: string,
}

type messageFromSocket = {
    message: string,
    roomId: number,
    sender: {
        name: string,
        id: number
    }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Page() {
    // ========== STATE ==========
    const { setWhereIsPrincipal, hasHydrated, loggedIn, currentUser } = useGlobalStore();
    const router = useRouter();
    const { socket, connect, connected } = useSocketStore();
    
    const [where, setWhere] = useState<"all" | "created" | "joined">("all");
    const [roomsCharging, startRoomsCharging] = useTransition();
    const [rooms, setRooms] = useState<room[]>([]);
    const [currentRoom, setCurrentRoom] = useState<room>();
    const [message, setMessage] = useState<string>("");
    const [messages, setMessages] = useState<messageFromSocket[]>([]);
    const [newlyReceivedMessage, setNewlyReceivedMessage] = useState<messageFromSocket>();
    const [menuOpen, setMenuOpen] = useState<boolean>(false);

    // ========== INITIALIZATION & AUTH CHECK ==========
    useEffect(() => {
        if (hasHydrated) {
            // Check if user is logged in
            if (!loggedIn) {
                setWhereIsPrincipal("login");
                router.push("/login");
                return
            }

            setWhereIsPrincipal("myRooms");

            // Connect socket if not already connected
            if (!connected) {
                connect();
            }
        }
    }, [hasHydrated, loggedIn, connected, connect, router, setWhereIsPrincipal]);

    // ========== SOCKET EVENT LISTENERS ==========
    useEffect(() => {
        if (socket) {
            // Handler for receiving new messages
            const handler = (message: messageFromSocket) => {
                setNewlyReceivedMessage(message);
            };

            // Handler for when a user leaves or room is deleted
            const userLeaveHandler = (response: {
                user: {
                    name: string,
                    email: string,
                    id: number
                },
                room_id: number
            }) => {
                console.log(response, currentRoom);

                startRoomsCharging(async () => {
                    // Clear current room if it matches the deleted/left room
                    setCurrentRoom((prev) => {
                        if (prev?.id === Number(response.room_id)) {
                            return undefined
                        } else return prev
                    });

                    // Clear messages if they're from the deleted/left room
                    setMessages((prev) => {
                        if (prev.length > 0) {
                            if (prev[0].roomId === Number(response.room_id)) return []
                            else return prev
                        } else return prev
                    })

                    // Refresh rooms list
                    const axiosResponse = await axiosInstance.get(`/api/get_rooms/${where}`);
                    console.log(axiosResponse.data);
                    if (axiosResponse.data.rooms) {
                        setRooms(axiosResponse.data.rooms);
                    } else {
                        setRooms([]);
                    }
                    setMenuOpen(false);
                });
            };

            // Attach listeners
            socket.on("receive-message", handler);
            socket.on("user-leaved", userLeaveHandler)

            // Cleanup listeners
            return () => {
                socket.off("receive-message", handler);
                socket.off("user-leaved", userLeaveHandler)
            }
        }
    }, [socket, where, currentRoom]);

    // ========== LOAD ROOMS BY FILTER ==========
    useEffect(() => {
        startRoomsCharging(async () => {
            console.log(where);
            const response = await axiosInstance.get(`/api/get_rooms/${where}`);
            console.log(response.data);
            if (response.data.rooms) {
                setRooms(response.data.rooms);
            } else {
                setRooms([]);
            }
        })
    }, [where]);

    // ========== PROCESS NEWLY RECEIVED MESSAGES ==========
    useEffect(() => {
        if (newlyReceivedMessage && currentRoom) {
            console.log(newlyReceivedMessage.roomId, currentRoom.id);

            if (newlyReceivedMessage.roomId === currentRoom.id) {
                // Message is for the current room - add it to messages
                console.log("new message received for the current room", {
                    sender: newlyReceivedMessage.sender.name,
                    message: newlyReceivedMessage.message,
                    room: newlyReceivedMessage.roomId
                });
                setMessages((prev) => [...prev, newlyReceivedMessage]);
            }
            else {
                // Message is for another room
                console.log("message for another room ", {
                    sender: newlyReceivedMessage.sender.name,
                    message: newlyReceivedMessage.message,
                    room: newlyReceivedMessage.roomId
                });
            }
        } else if (newlyReceivedMessage && !currentRoom) {
            // No current room selected but received a message
            console.log("new message ", {
                sender: newlyReceivedMessage.sender.name,
                message: newlyReceivedMessage.message,
                room: newlyReceivedMessage.roomId
            });
        }
    }, [newlyReceivedMessage, currentRoom]);

    // ========== EVENT HANDLERS ==========

    const onRoomClick = useCallback(async (room: room) => {
        setCurrentRoom(room);
        
        // Fetch messages for the selected room
        const response = await axiosInstance.get(`/api/get_messages/${room.id}`);
        if (response.data.message === "success") {
            setMessages(response.data.messagesTable as messageFromSocket[]);
        } else {
            console.log("error while getting room's messages");
        }
    }, []);

    const onMenuClick = useCallback(async () => {
        setMenuOpen(!menuOpen);
    }, [menuOpen]);

    const onSendClick = useCallback(async () => {
        if ((message.trim().length > 0) && currentRoom) {
            socket?.emit("send-message", {
                roomId: currentRoom.id,
                message: message.trim(),
            });
            setMessage("");
        }
    }, [message, socket, currentRoom]);

    const onDeleteRoomClick = useCallback(async () => {
        console.log("deleting chat");
        const res = await axiosInstance.get(`/api/delete_room/${currentRoom?.id}`);
        if (res.data.message === "success") {
            console.log("done");
            socket?.emit("room-deleted", { roomId: currentRoom?.id });
        } else {
            console.log(res.data)
        }
    }, [currentRoom, socket]);

    const onLeaveRoomClick = useCallback(async () => {
        console.log("leaving-room");
        const res = await axiosInstance.get(`/api/leave_room/${currentRoom?.id}`);
        if (res.data.message === "success") {
            console.log("done");
            socket?.emit("leave-room", { roomId: currentRoom?.id });
        } else {
            console.log(res.data)
        }
    }, [currentRoom, socket]);

    // ========== RENDER ==========

    return <>
        <div className="p-3 flex gap-2 h-dvh">
            {/* LEFT PANEL: ROOMS LIST */}
            <div className="h-full w-full flex flex-col gap-2">
                <HeaderComponent />
                
                <div className=" bg-white rounded-md h-full w-full border border-slate-300 p-3 flex flex-col gap-5 overflow-auto">
                    <p className="text-xl font-bold">{"@"}your_rooms</p>

                    {/* FILTER BUTTONS */}
                    <div className="flex gap-1 *:cursor-pointer *:hover:border-black">
                        <button
                            onClick={() => !(where === "all") && setWhere("all")}
                            className={`${where === "all" ? "border-black" : "border-transparent"} bg-slate-200 text-blackborder border rounded-sm p-3`}
                        >
                            All
                        </button>
                        
                        <button
                            onClick={() => !(where === "created") && setWhere("created")}
                            className={`${where === "created" ? "border-black" : "border-transparent"} bg-slate-200 text-black border rounded-sm p-3`}
                        >
                            Created rooms
                        </button>
                        
                        <button
                            onClick={() => !(where === "joined") && setWhere("joined")}
                            className={`${where === "joined" ? "border-black" : "border-transparent"} bg-slate-200 text-black border rounded-sm p-3`}
                        >
                            Joined rooms
                        </button>
                    </div>

                    {/* ROOMS LIST */}
                    <div className="w-full h-full overflow-auto flex flex-col gap-1">
                        {roomsCharging ? (
                            <p className="text-slate-600">charging...</p>
                        ) : (
                            <>
                                {(rooms.length >= 1) ? (
                                    rooms.map((room) => {
                                        return <div 
                                            key={room.id} 
                                            className={`flex gap-2 items-center bg-slate-50/50 cursor-pointer hover:bg-slate-100 p-3 rounded-md ${(currentRoom?.id === room.id) && "bg-slate-100"}`}
                                            onClick={() => onRoomClick(room)}
                                        >
                                            <div className="w-10 h-10 bg-black rounded-full"></div>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-black font-semibold">{room.room_name}</p>
                                            </div>
                                        </div>
                                    })
                                ) : (
                                    <p className="text-slate-600">no room to show...</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: CHAT VIEW */}
            <div className="w-full rounded-md bg-slate-50 border border-slate-300 p-3 h-full flex flex-col gap-2">
                <div className="h-full w-full flex flex-col gap-2">
                    
                    {/* ROOM HEADER WITH MENU */}
                    <div className="relative w-full flex justify-between rounded-md p-3 border-slate-200 border bg-white">
                        <div className="flex gap-2 items-center">
                            <div className="w-10 h-10 bg-black rounded-full"></div>
                            {currentRoom && (
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium">{currentRoom.room_name}</p>
                                    <p className="text-xs"> ~ id: {currentRoom.id}</p>
                                </div>
                            )}
                        </div>

                        {currentRoom && (
                            <>
                                <button
                                    onClick={onMenuClick}
                                    className="p-3 rounded-md bg-slate-100 relative cursor-pointer hover:bg-slate-200"
                                >
                                    {menuOpen ? "Close" : "Open"} menu
                                </button>

                                {/* DROPDOWN MENU */}
                                {menuOpen && (
                                    <div className="absolute top-[90%] right-3 w-fit bg-white *:p-2 rounded-sm p-1 flex flex-col gap-1 *:bg-white border border-slate-200 *:hover:bg-slate-200 *:rounded-sm shadow-sm *:cursor-pointer">
                                        {(currentRoom?.created_by === currentUser.id) ? (
                                            <button 
                                                className="text-red-500 hover:bg-red-100!"
                                                onClick={onDeleteRoomClick}
                                            >
                                                Delete room
                                            </button>
                                        ) : (
                                            <button 
                                                className="text-red-500 hover:bg-red-100!"
                                                onClick={onLeaveRoomClick}
                                            >
                                                Leave room
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* MESSAGES DISPLAY */}
                    <div className="w-full h-full py-3 overflow-auto space-y-2 rounded-md">
                        {messages.map((message, i) => {
                            return <div 
                                key={i} 
                                className={`rounded-md w-fit 
                                flex p-2 px-3 bg-slate-200 text-black flex-col gap-1 max-w-[80%] 
                                ${(message.sender.id === currentUser.id) ? "ml-auto" : "mr-auto"}
                                `}
                            >
                                <p className="text-black/60">
                                    {(message.sender.id === currentUser.id) ? "You" : message.sender.name} :
                                </p>
                                <p>
                                    {message.message}
                                </p>
                            </div>
                        })}
                    </div>

                    {/* MESSAGE INPUT */}
                    <div className="p-3 border-slate-200 border shadow-md w-full rounded-md flex gap-2 bg-white">
                        <input
                            id="changeInput"
                            onChange={(e) => setMessage(e.target.value)}
                            value={message}
                            onKeyDown={(e) => {
                                if (e.code.toLowerCase() === "enter") {
                                    onSendClick();
                                }
                            }}
                            type="text" 
                            className="w-full p-3 outline-none" 
                            placeholder="Type a message..." 
                        />
                        <button
                            onClick={onSendClick}
                            className="p-3 bg-black text-white rounded-md cursor-pointer hover:bg-black/80"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </>
}