'use client'
import { useRouter } from "next/navigation";
import { useGlobalStore } from "../store/use-globale-store"
import { useState } from "react";
import LogOutComponent from "./logOut";

export default function HeaderComponent () {
    const router = useRouter();
    const { currentUser, whereIsPrincipal, setWhereIsPrincipal } = useGlobalStore();
    console.log("whereIsPrincipal: ", whereIsPrincipal);
    const [isLoggingOut, setIsLoggingOut] = useState<boolean> (false);
    return <>
        { isLoggingOut && <LogOutComponent setIsLoggingOut={setIsLoggingOut}/> }
        <header className={`
            ${((whereIsPrincipal ==="createRoom" || whereIsPrincipal === "joinRoom") 
            ? "fixed top-3 w-[95dvw]"
            : "")} 
            border border-slate-300 
            bg-white flex justify-between p-3 rounded-sm
        `}>
            <div className="flex gap-2 items-center">
                <div className="w-10 h-10 bg-black rounded-full">
                </div>
                <p>{currentUser.name}</p>
            </div>
            <div className="flex gap-1 *:cursor-pointer ">
                <button className="bg-red-100 rounded-sm p-3 hover:bg-red-200 text-red-600"
                onClick={() => setIsLoggingOut(true)}
                >Log out</button>
                {(whereIsPrincipal !== "joinRoom") &&
                <button className="bg-slate-200 text-black  rounded-sm p-3 hover:bg-slate-300"
                onClick={() => {
                    router.push("/join_room");
                }}
                >
                    Join a room
                </button>
                } 
                {(whereIsPrincipal !== "createRoom") &&
                <button className="bg-slate-200 text-black  rounded-sm p-3 hover:bg-slate-300"
                onClick={() => {
                    router.push("/create_room");
                }}
                >
                    Create a room
                </button>
                }
                {(whereIsPrincipal !== "myRooms") && 
                <button className="bg-slate-200 text-black  rounded-sm p-3 hover:bg-slate-300"
                onClick={() => {
                    router.push("/my_rooms");
                }}
                >
                    My rooms
                </button>
                }
            </div>
        </header>
    </>
}