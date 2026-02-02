'use client';
import axios from "axios";
import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { z } from "zod";
import { useGlobalStore } from "../store/use-globale-store";
import HeaderComponent from "./header";

const emailSchema = z
.string()
.trim()
.toLowerCase()
.refine((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), "Invalid email address");

const passwordSchema = z
.string()
.min(8, "Password must be at least 8 characters")
.max(64, "Password is too ling")
.refine((val) => /[a-z]/.test(val), "Password must contain a lowercase letter")
.refine((val) => /[A-Z]/.test(val), "Password must contain an uppercase letter")
.refine((val) => /\d/.test(val), "Password must contain a number")
.refine((val) => /[^A-Za-z0-9]/.test(val), "Password must contain a special character");

export default function SignIn () {
    const {setCurrentUser, setWhereIsPrincipal, setLoggedIn} = useGlobalStore();
    
    const [visiblePassword, setVisiblePassword] = useState<boolean>(false);
    const [password, setPassword] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [emailErrors, setEmailErrors] = useState<boolean>(false);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [isThereErrors, setIsThereErrors] = useState<boolean>(false);
    const [isContinuing, startContinuing] = useTransition();

    const onContinuingClick = () => {
        startContinuing (async () => {
            // await from the backend
            // TODO : Try connection to the backend
            const response = await axios.post("http://localhost:3000/api/login",{
                email, password   
            });
            console.log(response);
            if (response.data === "emailDoesnNotExist") {
                setEmailErrors(true);
            }
            else if (response.data === "incorrectPassword") {
                setPasswordErrors(["Incorrect password"]);
            }
            else if (response.data === "errorWhenCreatingSession") {
                console.log("TRY AGAIN");
            } else if (response.data === "doneLoggingIn" || response.data === "loggedIn") {
                const response = await axios.get("http://localhost:3000/api/getCurrentUser");
                setCurrentUser(response.data.user);
                setWhereIsPrincipal("createRoom");
            }
        });
    };

    const continuingConditions: boolean = (
        (email.length > 0) && 
        (password.length > 0) && 
        (isThereErrors === false)
    );

    const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
        // setEmailErrors if errors;
        const value: string = e.target.value;
        const result = emailSchema.safeParse(value);
        if (result.success) {
            setEmailErrors(false);
            setEmail(value);
        } else {
            setEmailErrors(true);
            setEmail("");
        }
    };

    const onPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value: string = e.target.value;
        const result = passwordSchema.safeParse(value);
        if (result.success) {
            setPasswordErrors([]);
            setPassword(value);
        } else {
            setPassword("");
            const messages: string[] = result.error.issues.map((err) => err.message);
            setPasswordErrors(messages);
        }
    };

    useEffect(() => {
        !(emailErrors && passwordErrors.length > 0) ? setIsThereErrors(false) : setIsThereErrors(true);
    }, [email, password]);
    
    return <div className="w-full h-dvh flex items-center justify-center flex-col">
        <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-200 shadow-sm">
            <div className="text-center space-y-3">
                <p className="text-xl font-bold">{"@"}connection</p>
                <p className=" text-slate-600">Please enter your credentials</p>
            </div>
            <div className="space-y-2">
                <div className="space-y-1">
                    <label htmlFor="email" className="text-black/80">Email : </label>
                    <input 
                        type="email" name="email" 
                        onChange={(e) => onEmailChange(e)}
                        placeholder="your email address"
                        className="border rounded-sm p-3 w-full border-slate-200"
                    />
                    {emailErrors && <p className="mx-2 text-sm text-red-500">
                        * Invalid or wrong email 
                    </p>}
                </div>
                <div className="">
                    <label htmlFor="password" className="text-black/80">Password : </label>
                    <div className="flex gap-2 items-center">
                        <input 
                            placeholder="password"
                            type={!visiblePassword ? "password" : "text"} 
                            name="your password" 
                            onChange={(e) => onPasswordChange(e)}
                            className="border rounded-sm p-3 w-full border-slate-200"
                        />
                        <span 
                            className="text-sm cursor-pointer text-black/80"
                            onClick={() => setVisiblePassword(!visiblePassword)}
                        >
                            {visiblePassword ? "Hide" : "See"}
                        </span>
                    </div>
                    {passwordErrors.length > 0 && <ul className="mx-2 text-sm text-red-500">
                        {passwordErrors.map((error, i) => {
                            return <li key={i}>* {error}</li>
                        })}
                    </ul>}
                </div>
            </div>
             <button 
                className={`w-full p-3 rounded-sm bg-black hover:bg-black/85 text-white font-semibold cursor-pointer ${(!continuingConditions || isContinuing) && " opacity-50 "}`}                
                onClick={() => {
                    if (continuingConditions) {
                        onContinuingClick();
                    }
                }}
            >{isContinuing ? "Continuing..." : "Continue"}</button>
            <p className="text-center text-black/50 w-[80%] m-auto">
                Don't have an account ? Click <span className="font-medium underline cursor-pointer"
                onClick = {() => setWhereIsPrincipal("signup")}
                >here</span>.
            </p>
        </div>            
    </div>
}