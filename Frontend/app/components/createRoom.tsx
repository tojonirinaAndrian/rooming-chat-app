"use client";

import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import HeaderComponent from "./header";
import axiosInstance from "../axios/axiosInstance";

export default function CreateRoom () {
    const router = useRouter();
    const { 
       loggedIn, setLoggedIn, whereIsPrincipal, setWhereIsPrincipal, hasHydrated, setRoomState
    } = useGlobalStore();
    const [creatingRoom, startCreatingRoom] = useTransition();
    const [roomName, setRoomName] = useState<string> ("");
    const [roomNameError, setRoomNameError] = useState<string>("");
    const [globalState, setGlobalState] = useState<string>("");
    const [success, setSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (hasHydrated) {
            console.log("loggedIn: ", loggedIn);
            if (loggedIn === false) {
                setWhereIsPrincipal("login");
                router.push("/login");
                return
            }
            setWhereIsPrincipal("createRoom");
        }
    }, [hasHydrated]);

    //TODO : Create a function that triggers then the button create room is clicked
    const onCreateRoomClick = () => {
        startCreatingRoom(async () => {
            //TODO : Call from backend;
            const res = await axiosInstance.post("/api/createRoom", {
                room_name: roomName
            });
            if (res.data.message === "success") {
                setSuccess(true);
                setGlobalState("success");
                console.log("success");
            } else if (res.data.message === "roomNameAlreadyExists"){
                setGlobalState("* room already exists");
            } else {
                setGlobalState("* an error occured");
                if (res.data.error) {
                    console.log(res.data.error);
                }
            }
        })
    }
    const onRoomNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setRoomName(value);
        if (value.length > 5) {
            setRoomNameError("");
        } else {
            setRoomNameError("must be at least 5 characters");
        }
    }

    return <>
        <div className="w-full h-dvh flex items-center justify-center flex-col">
            <HeaderComponent />
            <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-300 shadow-sm">
                <div className="text-center space-y-3">
                    <p className="text-xl font-bold">{"@"}room_creation</p>
                    <p className=" text-slate-600">Please enter the room name</p>
                </div>
                <div className="space-y-3">
                    <input 
                        name="room_name"
                        onChange={(e) => onRoomNameChange(e)} 
                        type="text" 
                        className="p-3 rounded-sm border border-slate-300 w-full " placeholder="enter room name..."
                    />
                    {roomNameError.length > 0 && <p className="text-red-500! m-2">
                        * {roomNameError}
                    </p>} 
                    {globalState.length > 0 && <p className={`text-center font-semibold ${(globalState === "success") ? "text-green-600" : "text-red-500"}`}>
                        {globalState}
                    </p>}
                    {success && <button 
                        className={`w-full p-3 rounded-sm bg-slate-100 hover:bg-slate-200 text-black font-semibold cursor-pointer`}
                        onClick={(e) => {
                            router.push("/my_rooms")
                        }}
                    >Rooms</button>}
                    <button 
                        className={`w-full p-3 rounded-sm bg-black hover:bg-black/85 text-white font-semibold cursor-pointer ${(creatingRoom || roomName.length <= 5) && " opacity-50 "}`}
                        onClick={(e) => {
                            (roomName.length > 5) && onCreateRoomClick();
                        }}
                    >{creatingRoom ? "Creating room..." : "Create"}</button>
                </div>
            </div>            
        </div>
    </>
}