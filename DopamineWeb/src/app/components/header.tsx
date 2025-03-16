import ThemeToggler from "./secondary/themeToggler"
export default function Header() {
    return (
        <div className="flex justify-between items-center p-4">
            <div className="">
                <h1>Dopamine</h1>
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