'use client'
import { useRouter } from "next/navigation";
import { useGlobalStore } from "../store/use-globale-store"

export default function HeaderComponent () {
    const router = useRouter();
    const { currentUser, whereIsPrincipal, setWhereIsPrincipal } = useGlobalStore();
    console.log("whereIsPrincipal: ", whereIsPrincipal);
    return <>
        <header className="fixed top-3 w-[95dvw] bg-white flex justify-between p-3 rounded-sm shadow-sm">
            <div className="flex gap-2 items-center">
                <div className="w-10 h-10 bg-black rounded-full">
                </div>
                <p>{currentUser.name}</p>
            </div>
            <div className="flex gap-1">
                <button className="bg-black/10  rounded-sm p-3">Log out</button>
                {(whereIsPrincipal === "createRoom") &&
                <button className="bg-black text-white  rounded-sm p-3"
                onClick={() => {
                    setWhereIsPrincipal("joinRoom");
                    router.push("/join_room");
                }}
                >
                    Join a room
                </button>
                } 
                {(whereIsPrincipal === "joinRoom") &&
                <button className="bg-black text-white  rounded-sm p-3"
                onClick={() => {
                    setWhereIsPrincipal("createRoom");
                    router.push("/create_room");
                }}
                >
                    Create a room
                </button>
                }
            </div>
        </header>
    </>
}