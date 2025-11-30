import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLobby } from "../context/LobbyContext";
import { useSocket } from "../context/SocketContext";
import { getGradientFromId } from "../utils/avatarGradient";
import BackgroundChunks from "../components/BackgroundChunks";

export const LobbyRoom = () => {
	const { lobbyId } = useParams();
	const navigate = useNavigate();
	const { socket } = useSocket();
	const { currentLobby, leaveLobby, setReady, startGame } = useLobby();
	const [myReady, setMyReady] = useState(false);

	useEffect(() => {
		if (!currentLobby || currentLobby.id !== lobbyId) {
			navigate("/");
		}
	}, [currentLobby, lobbyId, navigate]);

	useEffect(() => {
		if (currentLobby && socket) {
			const me = currentLobby.players.find((p) => p.id === socket.id);
			if (me) {
				setMyReady(me.ready);
			}
		}
	}, [currentLobby, socket]);

	const handleLeave = () => {
		leaveLobby(lobbyId);
		navigate("/");
	};

	const handleToggleReady = async () => {
		const newReady = !myReady;
		await setReady(lobbyId, newReady);
	};

	const handleStartGame = async () => {
		const result = await startGame(lobbyId);
		if (!result.success) {
			alert(result.error);
		}
	};

	if (!currentLobby) {
		return null;
	}

	const isHost = currentLobby.hostId === socket?.id;
	const allReady = currentLobby.players.every((p) => p.ready);
	const canStart = allReady && currentLobby.players.length >= 2;

	return (
		<div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
			{/* Background gradient (separate so BackgroundChunks can sit above it) */}
			<div
				className="absolute inset-0 -z-20"
				style={{
					background: "radial-gradient(circle at center, #282964 0%, #252257 35%, #161533 100%)",
				}}
			/>
			{/* Animated background chunks (same as Home) */}
			<BackgroundChunks />
			<div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="md:col-span-2 bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h2 className="text-2xl md:text-3xl font-semibold text-white">
								Lobby: <span className="text-indigo-200">{currentLobby.id}</span>
							</h2>
							<p className="text-sm text-indigo-100/80 mt-1">
								Játékosok: <span className="font-medium">{currentLobby.players.length}</span> /<span className="font-medium"> {currentLobby.maxPlayers}</span>
							</p>
						</div>

						<div className="flex items-center gap-3">
							<button onClick={handleLeave} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-800 text-white shadow-sm transition" title="Kilépés a lobbyból">
								<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
									<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" />
									<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 8v8" />
								</svg>
								Kilépés
							</button>
						</div>
					</div>

					<div className="mt-3 grid gap-3 max-h-[60vh] overflow-auto pr-2">
						{currentLobby.players.map((player, idx) => {
							const isMe = player.id === socket?.id;
							const isHostPlayer = player.id === currentLobby.hostId;
							const displayName = isMe ? "Te" : player.id.substring(0, 8);
							return (
								<div key={player.id} className="flex items-center justify-between gap-4 bg-white/4 hover:bg-white/6 transition rounded-xl p-3">
									<div className="flex items-center gap-3">
										<div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg text-white flex-shrink-0`} style={{ background: getGradientFromId(player.id, idx) }} title={player.id}>
											👤
										</div>

										<div>
											<div className="flex items-center gap-2">
												<p className="text-white font-medium">{displayName}</p>
												{isHostPlayer && <span className="text-xs px-2 py-0.5 rounded-full text-white border border-white">Host</span>}
												{/* {isMe && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-200 border border-indigo-400/10">Te</span>} */}
											</div>
											{/* <p className="text-xs text-indigo-100/70 mt-0.5">{player.id}</p> */}
										</div>
									</div>

									<div className="flex items-center gap-3">
										{player.ready ? (
											<span className="inline-flex items-center gap-2 !px-3 py-1 rounded-full bg-green-500/20 text-green-200 text-sm font-medium border border-green-500/30">
												<svg className="w-4 h-4 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor">
													<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
												</svg>
												Kész
											</span>
										) : (
											<span className="inline-flex items-center gap-2 !px-3 py-1 rounded-full bg-gray-700 text-gray-200 text-sm">Várakozik</span>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<aside className="md:col-span-1 bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
					<div>
						<h3 className="text-lg font-semibold text-white mb-2">Játék vezérlő</h3>
						<p className="text-sm text-indigo-100/80 mb-4">
							Állapot: <span className={`font-medium ${allReady ? "text-green-300" : "text-yellow-200"}`}>{allReady ? "Mindenki kész" : "Várakozás"}</span>
						</p>

						<div className="space-y-3">
							<button onClick={handleToggleReady} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition ${myReady ? "bg-purple-300 hover:bg-purple-400 text-gray-900" : "bg-pink-500 hover:bg-pink-600 text-white"}`}>
								{myReady ? (
									<>
										<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
											<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
										Mégsem kész
									</>
								) : (
									<>
										<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
											<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
										</svg>
										Kész
									</>
								)}
							</button>

							{isHost && (
								<button onClick={handleStartGame} disabled={!canStart} className="w-full inline-flex items-center justify-center !my-2 gap-2 px-4 py-3 rounded-lg font-medium bg-indigo-400 hover:bg-indigo-500 text-gray-900 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-white transition">
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
										<path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
									</svg>
									Játék indítása
								</button>
							)}
						</div>
					</div>

					<div className="mt-6 text-center text-xs text-indigo-100/60">{isHost ? <p>Te vagy a host. Indítsd a játékot, ha mindenki kész.</p> : <p>Várj, amíg a host elindítja a játékot.</p>}</div>
				</aside>
			</div>
		</div>
	);
};
