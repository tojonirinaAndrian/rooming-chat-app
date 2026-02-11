'use client';
import axios from "axios";
import { ChangeEvent, useEffect, useState, useTransition } from "react";
import { z } from "zod";
import { useGlobalStore } from "../store/use-globale-store";
import { useRouter } from "next/navigation";
import axiosInstance from "../axios/axiosInstance";
import { socketConnection } from "../socket/socket";

// Schema for email and password validation
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

export default function SignUp() {
    const { setCurrentUser, setWhereIsPrincipal, setLoggedIn, hasHydrated } = useGlobalStore();
    const router = useRouter();

    const [visiblePassword, setVisiblePassword] = useState<boolean>(false);
    const [password, setPassword] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [emailErrors, setEmailErrors] = useState<boolean>(false);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [isThereErrors, setIsThereErrors] = useState<boolean>(false);
    const [username, setUsername] = useState<string>("");
    const [usernameError, setUsernameError] = useState<string>("");
    const [isContinuing, startContinuing] = useTransition();
    const [signupError, setSignupError] = useState<string>("");

    useEffect(() => {
        setWhereIsPrincipal("signup");
    }, [hasHydrated]);

    const onContinuingClick = () => {
        startContinuing(async () => {
            // await from the backend
            // TODO : Try connection to the backend
            const response = await axiosInstance.post("/api/signup", {
                name: username, email, password
            });
            if (response.data === "couldntSignUp") {
                setSignupError("An error happened when trying to sign up, please try again");
            } else if (response.data === "register") {
                setSignupError("An account with this email already exists, please try logging in");
            } else if (response.data === "doneSigningUp" || response.data === "loggedIn") {
                const response = await axiosInstance.get("/api/getCurrentUser");
                setCurrentUser(response.data.user);
                setWhereIsPrincipal("createRoom");
                setLoggedIn(true);
                // TODO : Join all rooms via websockets
                socketConnection.emit("join-all-rooms");
                router.push("/create_room");
            }
        });
    };

    const continuingConditions: boolean = (
        (email.length > 0) &&
        (password.length > 0) &&
        (isThereErrors === false) &&
        (username.length > 0)
    );

    const onUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value: string = e.target.value.trim();
        if (value.length <= 0) {
            setUsernameError("Fill the field");
        } else {
            setUsernameError("");
            setUsername(value);
        }
    };

    const onEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
        // setEmailErrors if errors;
        const value: string = e.target.value.trim();
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
        const value: string = e.target.value.trim();
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
        !(emailErrors && passwordErrors.length > 0 && usernameError) ? setIsThereErrors(false) : setIsThereErrors(true);
    }, [email, password, username]);

    return <div className="w-full h-dvh flex items-center justify-center flex-col">
        <div className="p-8 md:w-[40dvw] w-[95dvw] rounded-sm space-y-3 border border-slate-300 shadow-sm">
            <div className="text-center space-y-3">
                <p className="text-xl font-bold">{"@"}account_creation</p>
                <p className=" text-slate-600">Please enter your credentials</p>
            </div>
            <div className="space-y-2">
                <div className="space-y-1">
                    <label htmlFor="username" className="text-black/80">Username : </label>
                    <input
                        placeholder="your username"
                        type="text" name="username"
                        onChange={(e) => onUsernameChange(e)}
                        className="border rounded-sm p-3 w-full border-slate-300"
                    />
                    {usernameError.length > 0 && <p className="m-2 text-sm text-red-500">
                        * {usernameError}
                    </p>}
                </div>
                <div className="space-y-1">
                    <label htmlFor="email" className="text-black/80">Email : </label>
                    <input
                        type="email" name="email"
                        placeholder="your email address"
                        onChange={(e) => onEmailChange(e)}
                        className="border rounded-sm p-3 w-full border-slate-300"
                    />
                    {emailErrors && <p className="m-2 text-sm text-red-500">
                        * Invalid email
                    </p>}
                </div>
                <div className="">
                    <label htmlFor="password" className="text-black/80">Password : </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type={!visiblePassword ? "password" : "text"}
                            name="password"
                            placeholder="your password"
                            onChange={(e) => onPasswordChange(e)}
                            className="border rounded-sm p-3 w-full border-slate-300"
                        />
                        <span
                            className="text-sm cursor-pointer text-black/80"
                            onClick={() => setVisiblePassword(!visiblePassword)}
                        >
                            {visiblePassword ? "Hide" : "See"}
                        </span>
                    </div>
                    {passwordErrors.length > 0 && <ul className="m-2 text-sm text-red-500">
                        {passwordErrors.map((error, i) => {
                            return <li key={i}>* {error}</li>
                        })}
                    </ul>}
                </div>
            </div>
            {signupError.length > 0 && <p className="m-2 font-bold text-sm text-red-500 text-center">
                * {signupError}
            </p>}
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
                    onClick={() => { setWhereIsPrincipal("login"); router.push("/login") }}
                >here</span>.
            </p>
        </div>
    </div>
}