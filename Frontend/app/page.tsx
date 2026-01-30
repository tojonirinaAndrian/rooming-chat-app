"use client";
import Image from "next/image";
import { useState } from "react";
import CreateRoom from "./components/createRoom";
import SignIn from "./components/signIn";
import SignUp from "./components/signUp";
import { useGlobalStore } from "./store/use-globale-store";
import axios from "axios";

export default function Home() {
  const {whereIsPrincipal, setWhereIsPrincipal} = useGlobalStore()  
  return (
   <>
   {/* {whereIsPrincipal === "login" && <SignIn />}
   {whereIsPrincipal === "signup" && <SignUp />}
   {whereIsPrincipal === "createRoom" && <CreateRoom />} */}
   <div className="w-full h-dvh flex justify-center items-center">
    <button
    className="bg-black cursor-pointer p-3 text-white"
    onClick={async () => {
      // const response = await axios.get("http://localhost:3000/api/createRandomUsers");
      const response = await axios.post("http://localhost:3000/api/login",{
          email: "andrianjafiniaina21@gmail.com", 
          password: "tojonirinaEilish21!"   
      });
      console.log(response);
    }}
    >Click me to test</button>
   </div>
  </>
  );
}
