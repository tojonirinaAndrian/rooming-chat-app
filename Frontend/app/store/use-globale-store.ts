'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type whereIsPrincipalType = "login" | "signup" | "createRoom" | "joinRoom"
interface useStoreProps {
    whereIsPrincipal: whereIsPrincipalType,
    setWhereIsPrincipal: (arg0: whereIsPrincipalType) => void,
    loggedIn: boolean,
    setLoggedIn: (arg0: boolean) => void,
    currentUser: {
        name: string, email: string, id: number
    },
     setCurrentUser: (arg0: {
        name: string, email: string, id: number
    }) => void;
    hasHydrated: boolean;
    roomState: {
        name: string, id: number
    };
    setRoomState: (arg0 : {
        name: string, id: number
    }) => void
}

export const useGlobalStore = create<useStoreProps>() (
	persist (
        (set, get) => ({
            hasHydrated: false,
            whereIsPrincipal: "login",
            setWhereIsPrincipal : (where: whereIsPrincipalType) => {
                set(() => {
                    return ({
                        whereIsPrincipal: where
                    })
                })
            },
            loggedIn: false,
            setLoggedIn: (state: boolean) => {
                set(() => {
                    return ({
                        loggedIn: state
                    })
                })
            },
            currentUser: {
                name: "", id: 0, email: ""
            }, 
            setCurrentUser: (currentUser: {
                name: string, email: string, id: number
            }) => {
                set(() => {
                    return {
                        currentUser
                    }
                })
            },
            roomState: {
                name:"", id: 0
            },
            setRoomState: (state) => {
                set(() => {
                    return {
                        roomState: state
                    }
                })
            }
        }), {
            name: "global",
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.hasHydrated = true;
                }
            }
        }
    )
)