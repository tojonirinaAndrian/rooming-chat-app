'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface useStoreProps {
    whereIsPrincipal: string,
    setWhereIsPrincipal: (arg0: string) => void
}

export const useGlobalStore = create<useStoreProps>() (
	persist (
        (set, get) => ({
            whereIsPrincipal: "login",
            setWhereIsPrincipal : (where: string) => {
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