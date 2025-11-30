import { useState } from "react";
import { LobbyList } from "../components/LobbyList";
import { CreateLobby } from "../components/CreateLobby";
import { useSocket } from "../context/SocketContext";
import BackgroundChunks from "../components/BackgroundChunks";

export const Home = () => {
	const [activeTab, setActiveTab] = useState("list");
	const { connected } = useSocket();

	return (
		<div className="min-h-screen text-white relative overflow-hidden flex flex-col justify-center items-center">
			{/* Background gradient */}
			<div
				className="absolute inset-0 -z-20"
				style={{
					background: "radial-gradient(circle at center, #282964 0%, #252257 35%, #161533 100%)",
				}}
			/>

			{/* Animated background chunks */}
			<BackgroundChunks />
			<div className="container mx-auto flex flex-col items-center justify-center min-h-[60vh]">
				<header className="text-center mb-8 flex flex-col items-center justify-center flex-1">
					<h1 className="text-9xl font-bold mb-2">Code Clash</h1>
					<div className="flex items-center justify-center gap-2">
						<div className={`w-2 h-2 rounded-full ${connected ? "bg-green-600" : "bg-red-600"}`} />
						<p className="text-gray-400">{connected ? "Kapcsolódva" : "Kapcsolódás..."}</p>
					</div>
				</header>

				<div className="flex justify-center gap-4 !mb-8">
					<button onClick={() => setActiveTab("list")} className={`cursor-pointer font-semibold overflow-hidden relative z-100 border border-pink-300 group px-8 py-2 rounded-lg ${activeTab === "list" ? "bg-pink-300" : ""}`}>
						<span className={`relative z-10 text-xl duration-500 ${activeTab === "list" ? "text-indigo-950 group-hover:text-white" : "text-pink-300 group-hover:text-white"}`}>Szobák</span>
						<span className={`absolute w-full h-full ${activeTab === "list" ? "bg-pink-600" : "bg-pink-500"} -left-32 top-0 -rotate-45 group-hover:rotate-0 group-hover:left-0 duration-500`} />
						<span className={`absolute w-full h-full ${activeTab === "list" ? "bg-pink-600" : "bg-pink-500"} -right-32 top-0 -rotate-45 group-hover:rotate-0 group-hover:right-0 duration-500`} />
					</button>
					<button onClick={() => setActiveTab("create")} className={`cursor-pointer font-semibold overflow-hidden relative z-100 border border-pink-300 group px-8 py-2 rounded-lg ${activeTab === "create" ? "bg-pink-300" : ""}`}>
						<span className={`relative z-10 text-xl duration-500 ${activeTab === "create" ? "text-indigo-950 group-hover:text-white" : "text-pink-300 group-hover:text-white"}`}>Új szoba</span>
						<span className={`absolute w-full h-full ${activeTab === "create" ? "bg-pink-600" : "bg-pink-500"} -left-32 top-0 -rotate-45 group-hover:rotate-0 group-hover:left-0 duration-500`} />
						<span className={`absolute w-full h-full ${activeTab === "create" ? "bg-pink-600" : "bg-pink-500"} -right-32 top-0 -rotate-45 group-hover:rotate-0 group-hover:right-0 duration-500`} />
					</button>
				</div>

				<div className="w-full flex items-center justify-center">{activeTab === "list" ? <LobbyList /> : <CreateLobby />}</div>
			</div>
		</div>
	);
};
