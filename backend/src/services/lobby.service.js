// Manage game lobbies (create, join, leave, ready states)
class LobbyService {
	constructor() {
		this.lobbies = new Map();
	}

	// Create new lobby with host player
	createLobby(lobbyId, hostId, maxPlayers = 2) {
		if (this.lobbies.has(lobbyId)) {
			return { success: false, error: "Lobby already exists" };
		}

		const lobby = {
			id: lobbyId,
			hostId,
			maxPlayers,
			players: [{ id: hostId, ready: false }],
			game: null,
			createdAt: Date.now(),
		};

		this.lobbies.set(lobbyId, lobby);
		return { success: true, lobby };
	}

	// Add player to existing lobby
	joinLobby(lobbyId, playerId) {
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			return { success: false, error: "Lobby not found" };
		}

		if (lobby.players.length >= lobby.maxPlayers) {
			return { success: false, error: "Lobby is full" };
		}

		const playerExists = lobby.players.some((p) => p.id === playerId);
		if (playerExists) {
			return { success: false, error: "Player already in lobby" };
		}

		lobby.players.push({ id: playerId, ready: false });
		return { success: true, lobby };
	}

	// Remove player from lobby (delete if empty, reassign host if needed)
	leaveLobby(lobbyId, playerId) {
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			return { success: false, error: "Lobby not found" };
		}

		lobby.players = lobby.players.filter((p) => p.id !== playerId);

		if (lobby.players.length === 0) {
			this.lobbies.delete(lobbyId);
			return { success: true, lobbyDeleted: true };
		}

		if (lobby.hostId === playerId && lobby.players.length > 0) {
			lobby.hostId = lobby.players[0].id;
		}

		return { success: true, lobby };
	}

	getLobby(lobbyId) {
		return this.lobbies.get(lobbyId);
	}

	getAllLobbies() {
		return Array.from(this.lobbies.values());
	}

	// Toggle player ready state
	setPlayerReady(lobbyId, playerId, ready) {
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			return { success: false, error: "Lobby not found" };
		}

		const player = lobby.players.find((p) => p.id === playerId);
		if (!player) {
			return { success: false, error: "Player not in lobby" };
		}

		player.ready = ready;
		return { success: true, lobby };
	}

	// Check if all players are ready (minimum 2 players)
	canStartGame(lobbyId) {
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			return false;
		}

		return lobby.players.length >= 2 && lobby.players.every((p) => p.ready);
	}

	// Validate ready state before game start
	startGame(lobbyId) {
		const lobby = this.lobbies.get(lobbyId);

		if (!lobby) {
			return { success: false, error: "Lobby not found" };
		}

		if (!this.canStartGame(lobbyId)) {
			return { success: false, error: "Not all players are ready" };
		}

		return { success: true, lobby };
	}
}

export const lobbyService = new LobbyService();
