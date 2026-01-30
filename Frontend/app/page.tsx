"use client";
import Image from "next/image";
import { useState } from "react";
import CreateRoom from "./components/createRoom";
import SignIn from "./components/signIn";
import SignUp from "./components/signUp";
import { useGlobalStore } from "./store/use-globale-store";


export default function Home() {
  const {whereIsPrincipal, setWhereIsPrincipal} = useGlobalStore()  
  return (
   <>
   {whereIsPrincipal === "login" && <SignIn />}
   {whereIsPrincipal === "signup" && <SignUp />}
   {whereIsPrincipal === "createRoom" && <CreateRoom />}
   </>
  );
}
