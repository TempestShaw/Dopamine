'use client'
import ThemeToggler from "./secondary/themeToggler"
import Image from "next/image"

export default function Header() {
    return (
        <div className="flex bg-base-200 justify-between items-center p-4">
            <div className="flex items-center gap-2 font-bold">
                <Image 
                    src="/assets/DopamineLogo.svg" 
                    alt="Dopamine Logo" 
                    width={120} 
                    height={30}
                    className="dark:invert"
                />
            </div>
            <div className="flex gap-4 items-center">
                <div className="avatar">
                    <div className="w-8 rounded-full ring-primary ring-offset-base-100 ring ring-offset-2">
                        <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" alt="avatar" />
                    </div>
                </div>
                <ThemeToggler />
                <a href="/contact">Contact</a>
            </div>
        </div>
    )
}