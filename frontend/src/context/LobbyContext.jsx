import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useNavigate } from "react-router-dom";

// Lobby management context (create, join, leave, ready, start game)
const LobbyContext = createContext(null);

export const useLobby = () => {
	const context = useContext(LobbyContext);
	if (!context) {
		throw new Error("useLobby must be used within LobbyProvider");
	}
	return context;
};

export const LobbyProvider = ({ children }) => {
	const { socket } = useSocket();
	const navigate = useNavigate();
	const [lobbies, setLobbies] = useState([]);
	const [currentLobby, setCurrentLobby] = useState(null);

	const fetchLobbies = useCallback(() => {
		if (socket) {
			socket.emit("lobby:list", (response) => {
				if (response.success) {
					setLobbies(response.lobbies);
				}
			});
		}
	}, [socket]);

	const createLobby = useCallback(
		(lobbyId, maxPlayers = 4) => {
			return new Promise((resolve) => {
				if (socket) {
					socket.emit("lobby:create", { lobbyId, maxPlayers }, (response) => {
						if (response.success) {
							setCurrentLobby(response.lobby);
						}
						resolve(response);
					});
				}
			});
		},
		[socket]
	);

	const joinLobby = useCallback(
		(lobbyId) => {
			return new Promise((resolve) => {
				if (socket) {
					socket.emit("lobby:join", { lobbyId }, (response) => {
						if (response.success) {
							setCurrentLobby(response.lobby);
						}
						resolve(response);
					});
				}
			});
		},
		[socket]
	);

	const leaveLobby = useCallback(
		(lobbyId) => {
			if (socket) {
				try {
					socket.emit("lobby:leave", { lobbyId });
				} catch (e) {
					console.warn("Failed to emit lobby:leave", e);
				}
				try {
					socket.emit("game:leave", { lobbyId });
				} catch (e) {}
				setCurrentLobby(null);
			}
		},
		[socket]
	);

	const setReady = useCallback(
		(lobbyId, ready) => {
			return new Promise((resolve) => {
				if (socket) {
					socket.emit("lobby:ready", { lobbyId, ready }, (response) => {
						resolve(response);
					});
				}
			});
		},
		[socket]
	);

	const startGame = useCallback(
		(lobbyId) => {
			return new Promise((resolve) => {
				if (socket) {
					socket.emit("game:start", { lobbyId }, (response) => {
						resolve(response);
					});
				}
			});
		},
		[socket]
	);

	useEffect(() => {
		if (!socket) return;

		const handleLobbyUpdated = (lobby) => {
			setCurrentLobby(lobby);
			fetchLobbies();
		};

		const handleLobbyClosed = () => {
			setCurrentLobby(null);
			fetchLobbies();
		};

		const handleGameStarted = (data) => {
			const game = data.game;
			navigate(`/game/${game.id}`);
		};

		socket.on("lobby:updated", handleLobbyUpdated);
		socket.on("lobby:closed", handleLobbyClosed);
		socket.on("game:started", handleGameStarted);

		return () => {
			socket.off("lobby:updated", handleLobbyUpdated);
			socket.off("lobby:closed", handleLobbyClosed);
			socket.off("game:started", handleGameStarted);
		};
	}, [socket, fetchLobbies]);

	return (
		<LobbyContext.Provider
			value={{
				lobbies,
				currentLobby,
				fetchLobbies,
				createLobby,
				joinLobby,
				leaveLobby,
				setReady,
				startGame,
			}}
		>
			{children}
		</LobbyContext.Provider>
	);
};
