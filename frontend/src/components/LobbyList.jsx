import { useEffect } from "react";
import { useLobby } from "../context/LobbyContext";
import { useNavigate } from "react-router-dom";

export const LobbyList = () => {
	const { lobbies, fetchLobbies, joinLobby } = useLobby();
	const navigate = useNavigate();

	useEffect(() => {
		fetchLobbies();
		const interval = setInterval(fetchLobbies, 3000);
		return () => clearInterval(interval);
	}, [fetchLobbies]);

	const handleJoinLobby = async (lobbyId) => {
		const result = await joinLobby(lobbyId);
		if (result.success) {
			navigate(`/lobby/${lobbyId}`);
		}
	};

	return (
		<div className="!w-full max-w-4xl mx-auto p-6">
			<h2 className="text-2xl font-bold !mb-4 text-center">Elérhető szobák</h2>

			{lobbies.length === 0 ? (
				<div className="text-center py-12 bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg">
					<p className="text-gray-400">Nincs elérhető szoba</p>
				</div>
			) : (
				<div className="grid gap-4">
					{lobbies.map((lobby) => (
						<div key={lobby.id} className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg p-6 flex justify-between items-center hover:bg-gray-750 transition">
							<div>
								<h3 className="text-xl font-semibold mb-2">{lobby.id}</h3>
								<p className="text-gray-400">
									Játékosok: {lobby.players.length} / {lobby.maxPlayers}
								</p>
							</div>
							<button onClick={() => handleJoinLobby(lobby.id)} disabled={lobby.players.length >= lobby.maxPlayers} className="px-6 py-2 bg-pink-600 hover:bg-pink-800 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg font-medium transition">
								{lobby.players.length >= lobby.maxPlayers ? "Megtelt" : "Csatlakozás"}
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
