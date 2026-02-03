'use client';
import axiosInstance from "../axios/axiosInstance";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function LogOutComponent (props: {setIsLoggingOut: (arg0: boolean) => void}) {
    const { setWhereIsPrincipal } = useGlobalStore();
    const router = useRouter();
    const [logOutError, setLogOutError] = useState<boolean>(false);
    const onLogout = async () => {
        const response = await axiosInstance.get("/api/logout");
        if (response.data.message === "logoutSuccessful") {
            setWhereIsPrincipal("login");
            router.push("/login");
        } else if (response.data.message === "error") {
            setLogOutError(true);
        }
    };

    return <>
        <div className="w-full h-dvh flex items-center justify-center flex-col fixed top-0 z-5">
            <div className="w-dvw h-dvh bg-black/70 fixed top-0 z-6" onClick={() => props.setIsLoggingOut(false)}></div>
            <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border z-7 border-slate-200 shadow-sm bg-white">
                <div className="text-center space-y-3">
                    <p className="text-xl font-bold">{"@"}log_out</p>
                    <p className=" text-slate-600">Are you sure to log out now ?</p>
                </div>
                {logOutError && <p className="text-center font-bold m-2 text-red-500">
                    * an error happend, try again
                </p>}
                <div className="flex gap-1 *:w-full *:p-3 *:rounded-sm *:cursor-pointer">
                    <button 
                    className="bg-slate-200 hover:bg-slate-300"
                    onClick={() => props.setIsLoggingOut(false)}>Cancel</button>
                    <button className="bg-red-200 text-red-500 hover:bg-red-300/80"
                    onClick={onLogout}
                    >Log out</button>
                </div>
            </div>
        </div>
    </>
}