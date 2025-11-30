import { useState } from "react";
import { useLobby } from "../context/LobbyContext";
import { useNavigate } from "react-router-dom";

export const CreateLobby = () => {
	const [lobbyName, setLobbyName] = useState("");
	const [maxPlayers, setMaxPlayers] = useState(2);
	const [error, setError] = useState("");
	const { createLobby } = useLobby();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		if (!lobbyName.trim()) {
			setError("Add meg a szoba nevét!");
			return;
		}

		const result = await createLobby(lobbyName, maxPlayers);
		if (result.success) {
			navigate(`/lobby/${lobbyName}`);
		} else {
			setError(result.error || "Hiba történt");
		}
	};

	return (
		<div className="w-full max-w-md mx-auto p-6 text-center">
			<h2 className="text-2xl font-bold !mb-4">Új szoba létrehozása</h2>

			<form onSubmit={handleSubmit} className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg !p-3 space-y-4">
				<div>
					{/*<label className="block text-sm font-medium mb-2">Szoba neve</label>*/}
					<input type="text" value={lobbyName} onChange={(e) => setLobbyName(e.target.value)} placeholder="Szoba neve" className="w-full !p-1 text-xl ring ring-pink-300/15 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-300 text-center" />
				</div>

				<div>
					<label className="block text-sm font-medium mb-2 text-center">Max játékosok: {maxPlayers}</label>
					{/* <input type="range" min="2" max="2" value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value))} className="w-full" /> */}
				</div>

				{error && <div className="bg-red-900/50 text-red-200 px-4 py-2 rounded-lg">{error}</div>}

				<div className="flex justify-center">
					<button type="submit" className="w-4/5 cursor-pointer font-semibold overflow-hidden relative z-10 border bg-pink-400 border-pink-300 group px-8 py-2 rounded-lg">
						<span className="relative z-10 text-white text-xl duration-500">Létrehozás</span>
						<span className="absolute w-full h-full bg-pink-500 -left-60 top-0 -rotate-45 group-hover:rotate-0 group-hover:left-0 duration-500"></span>
						<span className="absolute w-full h-full bg-pink-500 -right-60 top-0 -rotate-45 group-hover:rotate-0 group-hover:right-0 duration-500"></span>
					</button>
				</div>
			</form>
		</div>
	);
};
