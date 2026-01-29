"use client";

import { ChangeEvent, useState, useTransition } from "react";
import axios from "axios";

export default function CreateRoom () {
    const [creatingRoom, startCreatingRoom] = useTransition();
    const [roomName, setRoomName] = useState<string> ("");
    //TODO : Create a function that triggers then the button create room is clicked
    const onCreateRoomClick = () => {
        startCreatingRoom(async () => {
            //TODO : Call from backend;
            if (roomName.length > 0) {
                const res = await axios.get("/api/createRoom");
                console.log("res : " + res.data);
            }
            
        })
    }
    const onRoomNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setRoomName(value);
    }

    return <>
        <div className="w-full h-dvh flex items-center justify-center flex-col">
            <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-200 shadow-sm">
                <div className="text-center space-y-3">
                    <p className="text-xl font-bold">{"@"}room_creation</p>
                    <p className=" text-slate-600">Please enter the room name</p>
                </div>
                <div className="space-y-1">
                    <input 
                        onChange={(e) => onRoomNameChange(e)} 
                        type="text" 
                        className="p-3 rounded-sm border border-slate-200 w-full " placeholder="enter room name..."
                    />
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