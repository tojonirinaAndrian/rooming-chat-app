"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import CreateRoom from "./components/createRoom";
import SignIn from "./components/signIn";
import SignUp from "./components/signUp";
import { useGlobalStore } from "./store/use-globale-store";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const {whereIsPrincipal, setWhereIsPrincipal, loggedIn, hasHydrated} = useGlobalStore();
  
  useEffect(() => {
    if (hasHydrated) {
      if (loggedIn) {
        setWhereIsPrincipal("createRoom");
        router.push("/create_room");
      } else {
        setWhereIsPrincipal("login");
        router.push("/login");
      }
    }
  }, [hasHydrated]);

  return (
   <>
    {/*
      <div className="w-full h-dvh flex justify-center items-center">
        <button
        className="bg-black cursor-pointer p-3 text-white"
        onClick={async () => {
          // const response = await axios.get("http://localhost:3000/api/createRandomUsers");
          const response = await axios.post("http://localhost:3000/api/signup",{
              email: "andrianjafiniaina21@gmail.com", 
              password: "tojonirinaEilish21!",
              username: "tojonirina"
          });
          console.log(response);
        }}
        >Click me to test</button>
      </div> 
    */}
  </>
  );
}
