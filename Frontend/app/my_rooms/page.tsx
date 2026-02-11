'use client';

import { useEffect, useState, useTransition } from "react";
import HeaderComponent from "../components/header";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import axiosInstance from "../axios/axiosInstance";
import { useSocketStore } from "../store/use-socket-store";

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
    content: string,
    sender: {
        name: string;
        email: string;
        id: number;
    }
}

export default function Page() {
    const { setWhereIsPrincipal, hasHydrated, loggedIn, currentUser } = useGlobalStore();
    const router = useRouter();
    useEffect(() => {
        if (hasHydrated) {
            if (loggedIn === false) {
                setWhereIsPrincipal("login");
                router.push("/login");
                return
            }
            setWhereIsPrincipal("myRooms");
        }
    }, [hasHydrated]);
    const [where, setWhere] = useState<"all" | "created" | "joined">("all");
    const [roomsCharging, startRoomsCharging] = useTransition();
    const [rooms, setRooms] = useState<room[]>([]);
    const [currentRoom, setCurrentRoom] = useState<room>();
    const [message, setMessage] = useState<string>("");
    const [messages, setMessages] = useState<messageFromSocket[]>([])

    useEffect(() => {
        startRoomsCharging(async () => {
            // TODO : get and show backend data 
            // add a room route in the backend too
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

    // TODo: useEffect when the user receives messages
    useEffect(() => {
        socketConnection.on("receive-message", (message: messageFromSocket) => {
            setMessages(prev => [...prev, message])
        });
        return () => {
            socketConnection.off("receive-message", (message: messageFromSocket) => {
                setMessages(prev => [...prev, message])
            });
        }
    }, [])

    const onRoomClick = async (room: room) => {
        // GET THE ROOMS messages (messages)
        setCurrentRoom(room);
        // TOdO: later, change this into the actual messages from the backend.
        setMessages([]);
    };

    const onSendClick = async () => {
        // SENDING THE MESSAGE ::: THE WHOLE CORE
        if (currentRoom) {
            socketConnection.emit("send-message", {
                roomName: currentRoom.room_name,
                roomId: currentRoom.id,
                message: message,
                currentUser: currentUser
            });
        }
    }

    return <>
        <div className="p-3 flex gap-2 h-dvh">
            <div className="h-full w-full flex flex-col gap-2">
                <HeaderComponent />
                <div className=" bg-white rounded-md h-full w-full border border-slate-300 p-3 flex flex-col gap-5 overflow-auto">
                    <p className="text-xl font-bold">{"@"}your_rooms</p>
                    <div className="flex gap-1 *:cursor-pointer *:hover:border-black">
                        <button
                            onClick={() => !(where === "all") && setWhere("all")}
                            className={`${where === "all" ? "border-black" : "border-transparent"} bg-slate-200 text-blackborder border rounded-sm p-3`}>All</button>
                        <button
                            onClick={() => !(where === "created") && setWhere("created")}
                            className={`${where === "created" ? "border-black" : "border-transparent"} bg-slate-200 text-black border rounded-sm p-3`}>Created rooms</button>
                        <button
                            onClick={() => !(where === "joined") && setWhere("joined")}
                            className={`${where === "joined" ? "border-black" : "border-transparent"} bg-slate-200 text-black border rounded-sm p-3`}>Joined rooms</button>
                    </div>
                    <div className="w-full h-full overflow-auto flex flex-col gap-1">
                        {roomsCharging ? <>
                            <p className="text-slate-600">charging...</p>
                        </> : <>
                            {(rooms.length >= 1) ? rooms.map((room) => {
                                return <div key={room.id} className={`flex gap-2 items-center bg-slate-50 cursor-pointer hover:bg-slate-100 p-3 rounded-md ${(currentRoom?.id === room.id) && "bg-slate-100"}`}
                                    onClick={() => {
                                        onRoomClick(room)
                                    }}
                                >
                                    <div className="w-10 h-10 bg-black rounded-full"></div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-black font-semibold">{room.room_name}</p>
                                    </div>
                                </div>
                            }) : <>
                                <p className="text-slate-600">no room to show...</p>
                            </>}
                        </>}
                    </div>
                </div>
            </div>
            <div className="w-full rounded-md bg-slate-50 border border-slate-300 p-3 h-full flex flex-col gap-2">
                <div className="h-full w-full flex flex-col gap-2">
                    <div className="w-full flex justify-between rounded-md p-3 border-slate-200 border bg-white">
                        <div className="flex gap-2 items-center">
                            <div className="w-10 h-10 bg-black rounded-full">
                            </div>
                            {currentRoom &&
                                <p>{currentRoom.room_name} ~ id: {currentRoom.id}</p>
                            }
                        </div>
                        <button className="p-3 rounded-md bg-slate-100 cursor-pointer hover:bg-slate-200">Menu</button>
                    </div>
                    <div className="w-full h-full p-3 overflow-auto space-y-2">
                        {/* messages */}
                        {messages.map((message, i) => {
                            return <div key={i} className="rounded-md w-fit flex p-2 bg-slate-200 text-black flex-col gap-2">
                                <p>{message.sender.name}</p>
                                <p>{message.content}</p>
                            </div>
                        })}
                    </div>
                    <div className="p-3 border-slate-200 border shadow-md w-full rounded-md flex gap-2 bg-white">
                        <input
                            onChange={(e) => e.target.value.trim().length >= 1 && setMessage(e.target.value.trim())}
                            type="text" className="w-full p-3 outline-none" placeholder="Type a message..." />
                        <button 
                        onClick={() => onSendClick()}
                        className="p-3 bg-black text-white rounded-md cursor-pointer hover:bg-black/80">Send</button>
                    </div>
                </div>
            </div>
        </div>
    </>
}