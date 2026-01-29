"use client";
import Image from "next/image";
import { useState } from "react";
import CreateRoom from "./components/createRoom";
import SignIn from "./components/signIn";
import SignUp from "./components/signUp";


export default function Home() {
  const [username, setUsername] = useState("Your username");
  
  return (
   <>
   {/* <CreateRoom /> */}
   {/* <SignIn /> */}
   <SignUp />
   </>
  );
}
