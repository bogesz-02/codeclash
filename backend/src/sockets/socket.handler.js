import { lobbyService } from "../services/lobby.service.js";
import { gameService } from "../services/game.service.js";
import { executionService } from "../services/execution.service.js";
import { deckService } from "../services/deck.service.js";

export function setupSocketHandlers(io) {
	io.on("connection", (socket) => {
		console.log(`Socket connected: ${socket.id}`);

		socket.on("lobby:create", (data, callback) => {
			const { lobbyId, maxPlayers } = data;
			const result = lobbyService.createLobby(lobbyId, socket.id, maxPlayers);

			if (result.success) {
				socket.join(lobbyId);
				callback({ success: true, lobby: result.lobby });
				io.to(lobbyId).emit("lobby:updated", result.lobby);
			} else {
				callback({ success: false, error: result.error });
			}
		});

		socket.on("lobby:join", (data, callback) => {
			const { lobbyId } = data;
			const result = lobbyService.joinLobby(lobbyId, socket.id);

			if (result.success) {
				socket.join(lobbyId);
				callback({ success: true, lobby: result.lobby });
				io.to(lobbyId).emit("lobby:updated", result.lobby);
				io.to(lobbyId).emit("lobby:player-joined", { playerId: socket.id });
			} else {
				callback({ success: false, error: result.error });
			}
		});

		socket.on("lobby:leave", (data) => {
			const { lobbyId } = data;
			const result = lobbyService.leaveLobby(lobbyId, socket.id);

			if (result.success) {
				socket.leave(lobbyId);

				if (result.lobbyDeleted) {
					io.to(lobbyId).emit("lobby:closed");
				} else {
					io.to(lobbyId).emit("lobby:updated", result.lobby);
					io.to(lobbyId).emit("lobby:player-left", { playerId: socket.id });
				}
			}
		});

		socket.on("lobby:ready", (data, callback) => {
			const { lobbyId, ready } = data;
			const result = lobbyService.setPlayerReady(lobbyId, socket.id, ready);

			if (result.success) {
				callback({ success: true });
				io.to(lobbyId).emit("lobby:updated", result.lobby);
			} else {
				callback({ success: false, error: result.error });
			}
		});

		socket.on("lobby:list", (callback) => {
			const lobbies = lobbyService.getAllLobbies();
			callback({ success: true, lobbies });
		});

		socket.on("game:start", async (data, callback) => {
			const { lobbyId } = data;
			const lobby = lobbyService.getLobby(lobbyId);

			if (!lobby) {
				callback({ success: false, error: "Lobby not found" });
				return;
			}

			if (lobby.hostId !== socket.id) {
				callback({ success: false, error: "Only host can start game" });
				return;
			}

			if (!lobbyService.canStartGame(lobbyId)) {
				callback({ success: false, error: "Not all players are ready" });
				return;
			}

			const game = gameService.createGame(lobbyId, lobby.players);

			let deck;
			try {
				deck = await deckService.buildDeck();
				console.log(`[game:start] Generated deck with ${deck.length} cards for game ${lobbyId}`);
				game.deck = deck;
			} catch (err) {
				console.error(`[game:start] Failed to build deck:`, err.message);
				callback({ success: false, error: "Failed to generate deck: " + err.message });
				return;
			}

			game.players.forEach((player) => {
				player.hand = [];

				for (let i = 0; i < 3; i++) {
					if (game.deck.length > 0) {
						const randomIndex = Math.floor(Math.random() * game.deck.length);
						player.hand.push(game.deck[randomIndex]);
						game.deck.splice(randomIndex, 1);
					}
				}

				console.log(`[game:start] Dealt ${player.hand.length} cards to player ${player.id}:`, player.hand.map((c) => c.variationKey || c.key).join(", "));
				player.turnPhase = "choose";
				player.hasDrawn = false;
			});

			console.log(`[game:start] Deck remaining: ${game.deck.length} cards`);
			callback({ success: true });
			io.to(lobbyId).emit("game:started", { game });
		});

		socket.on("game:action", (data, callback) => {
			const { gameId, action, payload } = data;

			callback({ success: true });
			io.to(gameId).emit("game:updated", { action, payload });
		});

		socket.on("game:draw", async (data, callback) => {
			const { gameId } = data;
			console.log(`[game:draw] Player ${socket.id} attempting to draw from game ${gameId}`);
			console.log(`[game:draw] Available games:`, Array.from(gameService.games.keys()));
			try {
				const result = gameService.drawCard(gameId, socket.id);
				if (result.game) {
					const p = result.game.players.find((pl) => pl.id === socket.id);
					console.log(`[game:draw] Before ready: phase=${p?.turnPhase} hasDrawn=${p?.hasDrawn} hand=${p?.hand?.length}`);
				}
				if (!result.success) {
					console.log(`[game:draw] Failed:`, result.error);
					callback?.({ success: false, error: result.error });
					return;
				}

				console.log(`[game:draw] Success! Drew card:`, result.card);
				callback?.({ success: true, card: result.card });

				const r = gameService.setPlayerReady(gameId, socket.id, true);
				if (r.success) {
					io.to(gameId).emit("game:updated", { action: "player-ready", payload: { playerId: socket.id, ready: true }, game: r.game });
					const p2 = r.game.players.find((pl) => pl.id === socket.id);
					console.log(`[game:draw] After ready: phase=${p2?.turnPhase} ready=${p2?.ready}`);
				}

				// If all are ready, execute and resolve round
				if (gameService.areAllPlayersReady(gameId)) {
					const game = gameService.getGame(gameId);

					const execResult = await executionService.executeRound(gameId);

					if (execResult.gameOver) {
						console.log(`[game:draw] Game over! Winner: ${execResult.winner?.id}, Loser: ${execResult.loser?.id}`);
						io.to(gameId).emit("game:over", {
							winner: execResult.winner,
							loser: execResult.loser,
							executionLogs: execResult.executionLogs,
							events: execResult.events,
							game: execResult.game,
						});
						gameService.games.delete(gameId);
						// Delete the lobby when game is over
						lobbyService.lobbies.delete(gameId);
					} else {
						const clearResult = gameService.clearTurnState(gameId);
						console.log(`[game:draw] Turn state cleared after auto-ready. Game still exists:`, !!gameService.getGame(gameId), "New round:", clearResult.game?.round);
						io.to(gameId).emit("game:round:resolved", {
							round: game.round - 1,
							executionLogs: execResult.executionLogs,
							events: execResult.events,
							game: clearResult.game,
						});
					}
				}
			} catch (err) {
				console.error("[game:draw] Unhandled error:", err);
				callback?.({ success: false, error: err?.message || String(err) });
			}
		});

		socket.on("game:choose:build", (data, callback) => {
			const { gameId } = data;
			const result = gameService.chooseBuild(gameId, socket.id);

			if (result.success) {
				callback({ success: true });
				io.to(gameId).emit("game:updated", { game: result.game });
			} else {
				callback({ success: false, error: result.error });
			}
		});

		// Get current game state
		socket.on("game:get", (data, callback) => {
			const { gameId } = data;
			const game = gameService.getGame(gameId);
			if (game) {
				callback?.({ success: true, game });
			} else {
				callback?.({ success: false, error: "Game not found" });
			}
		});

		socket.on("game:execute", async (data, callback) => {
			const { gameId, program } = data;
			try {
				const result = await executionService.execute(gameId, socket.id, program);
				if (result.success) {
					callback({ success: true, code: result.code, logs: result.logs, game: result.game });
					io.to(gameId).emit("game:updated", { action: "program-executed", payload: { playerId: socket.id, logs: result.logs } });
				} else {
					callback({ success: false, error: result.error, code: result.code, logs: result.logs });
				}
			} catch (err) {
				callback({ success: false, error: err.message });
			}
		});

		socket.on("game:program:submit", (data, callback) => {
			const { gameId, program } = data;
			const res = gameService.setProgram(gameId, socket.id, program);
			if (res.success) {
				callback({ success: true, game: res.game });
				io.to(gameId).emit("game:updated", { action: "program-submitted", payload: { playerId: socket.id }, game: res.game });
			} else {
				callback({ success: false, error: res.error });
			}
		});

		socket.on("game:program:preview", (data) => {
			const { gameId, program } = data;
			const res = gameService.setProgramPreview(gameId, socket.id, program);
			if (!res.success) {
				socket.emit("error", res.error);
				return;
			}
			io.to(gameId).emit("game:program:preview:update", {
				playerId: socket.id,
				programPreview: res.game.players.find((p) => p.id === socket.id)?.programPreview || [],
			});
		});

		socket.on("game:powerup:play", (data, callback) => {
			const { gameId, cardKey, targetBlockId } = data;
			console.log(`[game:powerup:play] Player ${socket.id} playing ${cardKey} in game ${gameId}`);
			console.log(`[game:powerup:play] Available games:`, Array.from(gameService.games.keys()));
			const game = gameService.getGame(gameId);
			if (!game) {
				console.log(`[game:powerup:play] Game not found!`);
				callback?.({ success: false, error: "Game not found" });
				return;
			}
			const player = game.players.find((p) => p.id === socket.id);
			if (!player) {
				callback?.({ success: false, error: "Player not in game" });
				return;
			}
			if (player.turnPhase === "execution") {
				callback?.({ success: false, error: "Cannot play powerup during execution phase" });
				return;
			}
			const res = gameService.playPowerup(gameId, socket.id, cardKey, targetBlockId);
			if (res.success) {
				console.log(`[game:powerup:play] Success! Game still exists:`, !!gameService.getGame(gameId));
				callback?.({ success: true, game: res.game });
				io.to(gameId).emit("game:updated", { action: "powerup-played", payload: { playerId: socket.id, cardKey, targetBlockId }, game: res.game });
				for (const pl of res.game.players) {
					io.to(gameId).emit("game:program:preview:update", {
						playerId: pl.id,
						programPreview: pl.programPreview || pl.program || [],
						isPowerupUpdate: true,
					});
				}
			} else {
				console.log(`[game:powerup:play] Failed:`, res.error);
				callback?.({ success: false, error: res.error });
			}
		});

		socket.on("game:turn:ready", async (data, callback) => {
			const { gameId, ready } = data;
			console.log(`[game:turn:ready] Player ${socket.id} ready=${ready} for game ${gameId}`);
			const r = gameService.setPlayerReady(gameId, socket.id, ready !== false);
			if (!r.success) {
				callback({ success: false, error: r.error });
				return;
			}
			io.to(gameId).emit("game:updated", { action: "player-ready", payload: { playerId: socket.id, ready: r.game.players.find((p) => p.id === socket.id)?.ready } });

			const allReady = gameService.areAllPlayersReady(gameId);
			if (allReady) {
				const game = gameService.getGame(gameId);
				console.log(`\n========== ROUND ${game.round} EXECUTION START ==========`);
				game.players.forEach((p, idx) => {
					const programNodes = p.program || p.programPreview || [];
					console.log(`Player ${idx} (${p.id.substring(0, 8)}):`, programNodes.map((n) => n.card || n.key).join(" -> "));
				});

				try {
					const result = await executionService.executeRound(gameId);
					console.log(`========== ROUND ${game.round} EXECUTION END ==========\n`);

					if (result.gameOver) {
						console.log(`[game:turn:ready] Game over! Winner: ${result.winner?.id}, Loser: ${result.loser?.id}`);
						io.to(gameId).emit("game:over", {
							winner: result.winner,
							loser: result.loser,
							executionLogs: result.executionLogs,
							events: result.events,
							game: result.game,
						});
						gameService.games.delete(gameId);
						// Delete the lobby when game is over
						lobbyService.lobbies.delete(gameId);
						callback?.({ success: true, gameOver: true });
					} else {
						const clearResult = gameService.clearTurnState(gameId);
						console.log(`[game:turn:ready] Turn state cleared. Game still exists:`, !!gameService.getGame(gameId), "New round:", clearResult.game?.round);

						io.to(gameId).emit("game:round:resolved", {
							round: clearResult.game.round - 1,
							executionLogs: result.executionLogs,
							events: result.events,
							game: clearResult.game,
						});
						callback?.({ success: true, round: clearResult.game.round - 1 });
					}
				} catch (err) {
					console.error(`[game:turn:ready] Round execution error:`, err);
					callback?.({ success: false, error: err.message });
				}
			} else {
				console.log(`[game:turn:ready] Not all players ready yet for game ${gameId}`);
				callback?.({ success: true, waitingForOthers: true });
			}
		});

		socket.on("game:discard", (data, callback) => {
			const { gameId, handIndex } = data;
			const res = gameService.discardCard(gameId, socket.id, handIndex);
			if (res.success) {
				callback?.({ success: true, card: res.card });
				io.to(gameId).emit("game:updated", { game: res.game });
			} else {
				callback?.({ success: false, error: res.error });
			}
		});

		socket.on("game:leave", (data) => {
			const { lobbyId } = data;
			console.log(`[game:leave] Player ${socket.id} leaving game ${lobbyId}`);

			const game = gameService.getGame(lobbyId);
			if (game) {
				const playerIndex = game.players.findIndex((p) => p.id === socket.id);
				if (playerIndex !== -1) {
					const opponent = game.players.find((p) => p.id !== socket.id);

					game.players.splice(playerIndex, 1);
					console.log(`[game:leave] Removed player ${socket.id} from game ${lobbyId}, ${game.players.length} players remaining`);

					if (opponent) {
						io.to(opponent.id).emit("game:player-disconnected", {
							playerId: socket.id,
							message: "Ellenfél elhagyta a játékot.",
						});
						console.log(`[game:leave] Notified opponent ${opponent.id} about leave`);
					}

					if (game.players.length === 0) {
						gameService.deleteGame(game.id);
						console.log(`[game:leave] Game ${game.id} deleted (no players remaining)`);
					}
				}
			}
		});

		socket.on("disconnect", () => {
			console.log(`Player disconnected: ${socket.id}`);

			const games = Array.from(gameService.games.values());
			games.forEach((game) => {
				const playerIndex = game.players.findIndex((p) => p.id === socket.id);
				if (playerIndex !== -1) {
					console.log(`Player ${socket.id} disconnected from game ${game.id}`);

					const opponent = game.players.find((p) => p.id !== socket.id);

					game.players.splice(playerIndex, 1);
					console.log(`[disconnect] Removed player ${socket.id} from game ${game.id}, ${game.players.length} players remaining`);

					if (opponent) {
						io.to(opponent.id).emit("game:player-disconnected", {
							playerId: socket.id,
							message: "Ellenfél elhagyta a játékot.",
						});
						console.log(`[disconnect] Notified opponent ${opponent.id} about disconnect`);
					}

					io.to(game.id).emit("game:player-disconnected", {
						playerId: socket.id,
						message: "Ellenfél elhagyta a játékot.",
					});

					if (game.players.length === 0) {
						gameService.deleteGame(game.id);
						console.log(`[disconnect] Game ${game.id} deleted (no players remaining)`);
					}
				}
			});

			const lobbies = lobbyService.getAllLobbies();
			lobbies.forEach((lobby) => {
				const isInLobby = lobby.players.some((p) => p.id === socket.id);
				if (isInLobby) {
					const result = lobbyService.leaveLobby(lobby.id, socket.id);

					if (result.success) {
						if (result.lobbyDeleted) {
							io.to(lobby.id).emit("lobby:closed");
						} else {
							io.to(lobby.id).emit("lobby:updated", result.lobby);
							io.to(lobby.id).emit("lobby:player-left", {
								playerId: socket.id,
							});
						}
					}
				}
			});
		});

		// TEST STATE HANDLER - for debugging and testing
		socket.on("game:test:setState", async (data, callback) => {
			const { gameId, testState } = data;
			const game = gameService.getGame(gameId);

			if (!game) {
				callback?.({ success: false, error: "Game not found" });
				return;
			}

			try {
				let deck = await deckService.buildDeck();

				// Helper to find card by key
				const findCard = (key) => {
					const card = deck.find((c) => c.key === key || c.variationKey === key);
					if (!card) {
						console.error(`Card not found: ${key}`);
					}
					return card;
				};

				if (testState === "test1") {
					// Test 1: player1 max health/energy with count_3, attack, energy
					// player2 max health/energy with dodge, draw_from_opponent, count_2
					game.players.forEach((player, idx) => {
						player.hp = 10;
						player.energy = 3;
						player.hand = [];
						player.program = null;
						player.programPreview = null;
						player.ready = false;
						player.turnPhase = "choose";
						player.hasDrawn = false;

						if (idx === 0) {
							// Player 1 hand
							const cards = [findCard("count_3"), findCard("attack"), findCard("energy")];
							player.hand = cards.filter((c) => c);
						} else {
							// Player 2 hand
							const cards = [findCard("dodge"), findCard("draw_from_opponent"), findCard("count_2")];
							player.hand = cards.filter((c) => c);
						}
					});
				} else if (testState === "test2") {
					// Test 2: player1 2 health, max energy with healing, cond_health_below_3, debug
					// player2 max health/energy with count_3, attack, bug
					game.players.forEach((player, idx) => {
						player.hp = idx === 0 ? 2 : 10;
						player.energy = 3;
						player.hand = [];
						player.program = null;
						player.programPreview = null;
						player.ready = false;
						player.turnPhase = "choose";
						player.hasDrawn = false;

						if (idx === 0) {
							// Player 1 hand
							const cards = [findCard("healing"), findCard("cond_health_below_3"), findCard("debug")];
							player.hand = cards.filter((c) => c);
						} else {
							// Player 2 hand
							const cards = [findCard("count_3"), findCard("attack"), findCard("bug")];
							player.hand = cards.filter((c) => c);
						}
					});
				}

				game.round = 1;

				callback?.({ success: true, game });
				io.to(gameId).emit("game:test:stateSet", { game });
			} catch (err) {
				console.error("[game:test:setState] Error:", err);
				callback?.({ success: false, error: err.message });
			}
		});
	});
}
