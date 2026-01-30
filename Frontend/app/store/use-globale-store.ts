'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type whereIsPrincipalType = "login" | "signup" | "createRoom"
interface useStoreProps {
    whereIsPrincipal: whereIsPrincipalType,
    setWhereIsPrincipal: (arg0: whereIsPrincipalType) => void
}

export const useGlobalStore = create<useStoreProps>() (
	persist (
        (set, get) => ({
            whereIsPrincipal: "login",
            setWhereIsPrincipal : (where: whereIsPrincipalType) => {
                set(() => {
                    return ({
                        whereIsPrincipal: where
                    })
                })
            }
        }), {
            name: "global"
        }
    )
)