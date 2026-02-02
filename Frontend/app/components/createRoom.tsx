"use client";

import { ChangeEvent, useEffect, useState, useTransition } from "react";
import axios from "axios";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import HeaderComponent from "./header";
import axiosInstance from "../axios/axiosInstance";

export default function CreateRoom () {
    const router = useRouter();
    const { 
       loggedIn, setLoggedIn, whereIsPrincipal, setWhereIsPrincipal 
    } = useGlobalStore()
    const [creatingRoom, startCreatingRoom] = useTransition();
    const [roomName, setRoomName] = useState<string> ("");
    const [firstEntry, setFirstEntry] = useState<boolean>(true);
    const [roomNameError, setRoomNameError] = useState<string>("");

    useEffect(() => {
        if (!loggedIn) {
            setWhereIsPrincipal("login");
            router.push("/login")
        };
    }, [firstEntry]);

    //TODO : Create a function that triggers then the button create room is clicked
    const onCreateRoomClick = () => {
        startCreatingRoom(async () => {
            //TODO : Call from backend;
            if (roomName.length > 0) {
                const res = await axiosInstance.get("/api/createRoom");
                console.log("res : " + res.data);
            }
        })
    }
    const onRoomNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setRoomName(value);
        if (value.length > 5) {
            setRoomNameError("");
        }
    }

    return <>
        <div className="w-full h-dvh flex items-center justify-center flex-col">
            <HeaderComponent />
            <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-200 shadow-sm">
                <div className="text-center space-y-3">
                    <p className="text-xl font-bold">{"@"}room_creation</p>
                    <p className=" text-slate-600">Please enter the room name</p>
                </div>
                <div className="space-y-1">
                    <label htmlFor="room_name">Room name :</label>
                        <input 
                            name="room_name"
                            onChange={(e) => onRoomNameChange(e)} 
                            type="text" 
                            className="p-3 rounded-sm border border-slate-200 w-full " placeholder="enter room name..."
                        />
                        {roomNameError.length > 0 && <p className="text-red">
                            {roomNameError}
                        </p>} 
                    <button 
                        className={`w-full p-3 rounded-sm bg-black hover:bg-black/85 text-white font-semibold cursor-pointer ${(creatingRoom || roomName.length <= 0) && " opacity-50 "}`}
                        onClick={(e) => {
                            (roomName.length > 0) && onCreateRoomClick();
                        }}
                    >{creatingRoom ? "Creating room..." : "Create"}</button>
                </div>
            </div>            
        </div>
    </>
}