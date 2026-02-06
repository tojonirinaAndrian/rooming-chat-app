'use client';

import { useEffect, useState, useTransition } from "react";
import HeaderComponent from "../components/header";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import axiosInstance from "../axios/axiosInstance";

type room = {
    room_name: string,
    id: number,
    created_at: Date,
    created_by: number,
    people_ids: number[]
}

export default function Page() {
    const { whereIsPrincipal, setWhereIsPrincipal, hasHydrated, loggedIn, currentUser } = useGlobalStore();
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
    useEffect(() => {
        startRoomsCharging(async () => {
            // const response = await axiosInstance.get(`/api/get_rooms/${where}`);
            // TODO : get and show backend data 
            // add a room route in the backend too
        })
    }, [setWhere]);
    
    const onRoomClick = async () => {
        // GET THE ROOMS messages (messages)
    };
    
    return <>
        <div className="flex gap-2 w-dvw h-dvh p-3">
            <div className="flex flex-col gap-2 w-[45%]">
                <HeaderComponent />
                <div className="rounded-md w-full border border-slate-300 bg-white p-3 h-full space-y-2">
                    <p className="text-xl font-bold">{"@"}your_rooms</p>
                    <div className="flex gap-1 *:cursor-pointer">
                        <button 
                        onClick={() => !(where === "all") && setWhere("all")}
                        className={`${where === "all" ? "bg-black text-white" : "bg-slate-200 text-black"} rounded-sm p-3`}>All</button>
                        <button 
                        onClick={() => !(where === "created") && setWhere("created")}                        
                        className={`${where === "created" ? "bg-black text-white" : "bg-slate-200 text-black"} rounded-sm p-3`}>Created rooms</button>
                        <button 
                        onClick={() => !(where === "joined") && setWhere("joined")}
                        className={`${where === "joined" ? "bg-black text-white" : "bg-slate-200 text-black"} rounded-sm p-3`}>Joined rooms</button>
                    </div>
                </div>
            </div>
            <div className="md:w-full rounded-md bg-slate-50 border border-slate-300 p-3 h-full flex flex-col gap-2">  
                <div className="h-full w-full flex flex-col gap-2">
                    <div className="w-full flex justify-between rounded-md p-3 border-slate-200 border bg-white shadow-md">
                        <div className="flex gap-2 items-center">
                            <div className="w-10 h-10 bg-black rounded-full">
                            </div>
                            <p>Room name</p>
                        </div>
                        <button className="p-3 rounded-md bg-slate-100">Menu</button>
                    </div>
                    <div className="w-full h-full p-3 ">
                        {/* //message */}
                    </div>
                </div>
                <div className="p-3 border-slate-200 border shadow-md w-full rounded flex gap-2 bg-white">
                    <input type="text" className="cursor-pointer w-full p-3 outline-none" placeholder="Type a message..."/>
                    <button className="p-3 bg-black text-white rounded-md">Send</button>
                </div>
            </div>
        </div>
    </>
}