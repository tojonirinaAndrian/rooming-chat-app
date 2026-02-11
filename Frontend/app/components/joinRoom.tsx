"use client";

import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import HeaderComponent from "./header";
import axiosInstance from "../axios/axiosInstance";
import { socketConnection } from "../socket/socket";

export default function JoinRoom() {
    const router = useRouter();
    const {
        loggedIn, currentUser, setWhereIsPrincipal, hasHydrated
    } = useGlobalStore();
    const [joiningRoom, startJoiningRoom] = useTransition();
    const [roomName, setRoomName] = useState<string>("");
    const [roomId, setRoomId] = useState<string>("");
    const [roomNameError, setRoomNameError] = useState<string>("");
    const [globalState, setGlobalState] = useState<string>("");
    const [success, setSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (hasHydrated) {
            if (loggedIn === false) {
                setWhereIsPrincipal("login");
                router.push("/login");
                return
            }
            setWhereIsPrincipal("joinRoom");
        }
    });

    //TODO : Create a function that triggers then the button create room is clicked
    const onJoinRoomClick = () => {
        startJoiningRoom(async () => {
            //TODO : Call from backend;
            if (roomName.length < 5) {
                setRoomNameError("* must be at least 5 characters");
                return
            }
            const res = await axiosInstance.get(`/api/joinRoom/${roomName}/${String(roomId)}`);
            console.log("res : " + res.data);
            if (res.data.message === "room_not_found") {
                console.log("An error happened");
                setGlobalState("* room not found");
            } else if (res.data.message === "own_room") {
                setGlobalState("* this is your own room");
            } else if (res.data.message === "success") {
                console.log("success");
                setSuccess(true);
                setGlobalState("success");
                //CREATE: Socket-io joining-room
                //TODO: Add this to the backend, Make it take user infos from the session
                socketConnection.emit("join-room", {
                    roomName,
                    roomId,
                    currentUser
                });
            };
        });
    };

    const onRoomNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setRoomName(value);
        if (value.length > 5) {
            setRoomNameError("");
        }
    }
    const onRoomIdChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setRoomId(value);
    }
    return <>
        <div className="w-full h-dvh flex items-center justify-center flex-col">
            <HeaderComponent />
            <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-300 shadow-sm">
                <div className="text-center space-y-3">
                    <p className="text-xl font-bold">{"@"}room_joining</p>
                    <p className=" text-slate-600">Please enter the room infos</p>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label htmlFor="room_name">Room name :</label>
                        <input
                            name="room_name"
                            onChange={(e) => onRoomNameChange(e)}
                            type="text"
                            className="p-3 rounded-sm border border-slate-300 w-full " placeholder="enter room name..."
                        />
                        {roomNameError.length > 0 && <p className="text-red">
                            {roomNameError}
                        </p>}
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="room_id">Room id :</label>
                        <input
                            name="room_id"
                            onChange={(e) => onRoomIdChange(e)}
                            type="text"
                            className="p-3 rounded-sm border border-slate-300 w-full " placeholder="enter room id..."
                        />
                    </div>
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
                        className={`w-full p-3 rounded-sm bg-black hover:bg-black/85 text-white font-semibold cursor-pointer ${(joiningRoom || roomName.length <= 0) && " opacity-50 "}`}
                        onClick={() => {
                            if (roomName.length > 0) onJoinRoomClick();
                        }}
                    >{joiningRoom ? "Joining room..." : "Join"}</button>

                </div>
            </div>
        </div>
    </>
}