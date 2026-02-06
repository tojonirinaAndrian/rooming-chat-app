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
        <div className="gap-2 flex flex-col w-dvw h-dvh p-3">
            <HeaderComponent />
            <div className="w-full flex gap-2 h-full *:rounded-sm">
                <div className="md:w-[40%] border border-slate-300 bg-white p-3 h-full space-y-2"
                >
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
                <div className="md:w-[60%] border border-slate-300 bg-white p-3 h-full"
                >

                </div>
            </div>

        </div>
    </>
}