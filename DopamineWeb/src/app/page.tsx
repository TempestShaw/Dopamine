import Image from "next/image";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
export default function Home() {
  return (
    <div className="">
    <Header />
    <main className="flex">
    <Sidebar />
    <div className="flex flex-col items-center bg-mute">
      <div className="">
        Daily Data
      </div>
    </div>
    </main>
    </div>
  );
}
