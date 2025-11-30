import { describe, it, expect, beforeEach, vi } from "vitest";
import { gameService } from "../../src/services/game.service.js";

describe("GameService", () => {
	beforeEach(() => {
		// Clear all games before each test
		gameService.games.clear();
	});

	describe("Game Creation and Initialization", () => {
		it("should create a new game with correct initial state", () => {
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };
			const gameId = "test-game";

			const game = gameService.createGame(gameId, [player1, player2]);

			expect(game).toBeDefined();
			expect(game.id).toBe(gameId);
			expect(game.players).toHaveLength(2);
			expect(game.players[0].hp).toBe(10);
			expect(game.players[0].energy).toBe(3);
			expect(game.state).toBe("waiting");
			expect(game.round).toBe(1);
		});

		it("should initialize deck with cards", () => {
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };
			const gameId = "test-game";

			const game = gameService.createGame(gameId, [player1, player2]);

			expect(game.deck).toBeDefined();
			expect(Array.isArray(game.deck)).toBe(true);
			expect(game.deck.length).toBe(0); // Empty initially, populated by initializeDeck
		});

		it("should give each player an initial hand of 3 cards", () => {
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };
			const gameId = "test-game";

			const game = gameService.createGame(gameId, [player1, player2]);

			expect(game.players[0].hand).toHaveLength(0); // Empty initially, populated by dealCards
			expect(game.players[1].hand).toHaveLength(0);
		});
	});

	describe("Player Actions", () => {
		let gameId;
		let player1Id;
		let player2Id;

		beforeEach(() => {
			gameId = "test-game";
			player1Id = "player1";
			player2Id = "player2";

			const player1 = { id: player1Id, username: "Alice" };
			const player2 = { id: player2Id, username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);
		});

		it("should allow player to draw a card", () => {
			const game = gameService.getGame(gameId);
			// Add a card to the deck first
			game.deck = [{ instanceId: "card1", key: "attack" }];
			const initialHandSize = game.players[0].hand.length;
			const initialDeckSize = game.deck.length;

			const result = gameService.drawCard(gameId, player1Id);

			expect(result.success).toBe(true);
			expect(game.players[0].hand.length).toBe(initialHandSize + 1);
			expect(game.deck.length).toBe(initialDeckSize - 1);
		});

		it("should not allow drawing beyond hand capacity (5)", () => {
			const game = gameService.getGame(gameId);

			// Fill hand to capacity
			game.players[0].hand = [{ instanceId: "c1" }, { instanceId: "c2" }, { instanceId: "c3" }, { instanceId: "c4" }, { instanceId: "c5" }];

			const result = gameService.drawCard(gameId, player1Id);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Hand is full"); // Capital H
		});

		it("should allow player to discard a card", () => {
			const game = gameService.getGame(gameId);
			// Add a card to hand first
			game.players[0].hand = [{ instanceId: "card1", key: "attack" }];
			const initialHandSize = game.players[0].hand.length;

			const result = gameService.discardCard(gameId, player1Id, 0);

			expect(result.success).toBe(true);
			expect(game.players[0].hand.length).toBe(initialHandSize - 1);
		});

		it("should allow player to choose build phase", () => {
			const result = gameService.chooseBuild(gameId, player1Id);

			expect(result.success).toBe(true);

			const game = gameService.getGame(gameId);
			expect(game.players[0].turnPhase).toBe("building");
		});

		it("should mark player as ready", () => {
			const game = gameService.getGame(gameId);
			game.state = "building";
			game.players[0].turnPhase = "building";
			game.players[0].program = [{ id: "block-1", card: "attack", params: { amount: 1 }, children: [] }];

			const result = gameService.setPlayerReady(gameId, player1Id, true);

			expect(result.success).toBe(true);
			expect(game.players[0].ready).toBe(true);
		});
	});

	describe("Program Management", () => {
		let gameId;
		let player1Id;

		beforeEach(() => {
			gameId = "test-game";
			player1Id = "player1";
			const player2Id = "player2";

			const player1 = { id: player1Id, username: "Alice" };
			const player2 = { id: player2Id, username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);
		});

		it("should update player program", () => {
			const program = [
				{ id: "block-1", card: "attack", params: { amount: 2 } },
				{ id: "block-2", card: "heal", params: { amount: 1 } },
			];

			const result = gameService.setProgram(gameId, player1Id, program);

			expect(result.success).toBe(true);

			const game = gameService.getGame(gameId);
			expect(game.players[0].program).toBeDefined();
			// Program should have same structure, verify key fields
			expect(game.players[0].program[0].card).toBe("attack");
			expect(game.players[0].program[1].card).toBe("heal");
		});

		it("should preserve program between rounds", () => {
			const game = gameService.getGame(gameId);
			const program = [{ id: "block-1", card: "attack", params: { amount: 2 } }];

			game.players[0].program = program;
			game.players[0].ready = true;

			gameService.clearTurnState(gameId);

			// Program should be preserved with added fields (bugged, capacity)
			expect(game.players[0].program[0].id).toBe("block-1");
			expect(game.players[0].program[0].card).toBe("attack");
			expect(game.players[0].program[0].params.amount).toBe(2);
			expect(game.players[0].ready).toBe(false);
		});

		it("should preserve bugged flags in program", () => {
			const game = gameService.getGame(gameId);
			const program = [
				{ id: "block-1", card: "attack", params: { amount: 2 }, bugged: true },
				{ id: "block-2", card: "heal", params: { amount: 1 }, bugged: false },
			];

			game.players[0].program = program;

			gameService.clearTurnState(gameId);

			expect(game.players[0].program[0].bugged).toBe(true);
			expect(game.players[0].program[1].bugged).toBe(false);
		});
	});

	describe("Turn State Management", () => {
		let gameId;

		beforeEach(() => {
			gameId = "test-game";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);
		});

		it("should clear turn state correctly", () => {
			const game = gameService.getGame(gameId);

			game.players[0].ready = true;
			game.players[1].ready = true;
			game.players[0].hasDrawn = true;
			game.players[1].hasDrawn = true;
			game.players[0].turnPhase = "execution";
			game.players[1].turnPhase = "execution";

			gameService.clearTurnState(gameId);

			expect(game.players[0].ready).toBe(false);
			expect(game.players[1].ready).toBe(false);
			expect(game.players[0].hasDrawn).toBe(false);
			expect(game.players[1].hasDrawn).toBe(false);
			expect(game.players[0].turnPhase).toBe("choose");
			expect(game.players[1].turnPhase).toBe("choose");
		});

		it("should increment round number", () => {
			const game = gameService.getGame(gameId);
			const initialRound = game.round;

			gameService.clearTurnState(gameId);

			expect(game.round).toBe(initialRound + 1);
		});
	});

	describe("Game State Queries", () => {
		it("should retrieve game by ID", () => {
			const gameId = "test-game";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);

			const game = gameService.getGame(gameId);

			expect(game).toBeDefined();
			expect(game.id).toBe(gameId);
		});

		it("should return undefined for non-existent game", () => {
			const game = gameService.getGame("non-existent-game");

			expect(game).toBeUndefined();
		});

		it("should check if both players are ready", () => {
			const gameId = "test-game";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);

			const game = gameService.getGame(gameId);
			game.players[0].ready = true;
			game.players[1].ready = false;

			const allReady = game.players.every((p) => p.ready);
			expect(allReady).toBe(false);

			game.players[1].ready = true;
			const allReadyNow = game.players.every((p) => p.ready);
			expect(allReadyNow).toBe(true);
		});
	});

	describe("Game Deletion", () => {
		it("should delete game from memory", () => {
			const gameId = "test-game";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);

			expect(gameService.getGame(gameId)).toBeDefined();

			gameService.games.delete(gameId);

			expect(gameService.getGame(gameId)).toBeUndefined();
		});
	});

	describe("Powerup Cards", () => {
		it("should upgrade capacity of a for_loop with capacity_increase powerup", () => {
			const gameId = "test-game";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);
			const game = gameService.getGame(gameId);
			const p1 = game.players.find((p) => p.id === "player1");

			// Enter building phase
			const chooseRes = gameService.chooseBuild(gameId, "player1");
			expect(chooseRes.success).toBe(true);

			// Add powerup to hand
			p1.hand.push({ key: "capacity_increase", type: "powerup", name: "Capacity +" });

			// Set preview with a for_loop node
			const nodeId = "loop-1";
			const preview = [{ id: nodeId, card: "for_loop", params: { count: 2 }, children: [] }];
			const setRes = gameService.setProgramPreview(gameId, "player1", preview);
			expect(setRes.success).toBe(true);
			expect(p1.programPreview[0].capacity).toBe(1); // default

			// Play powerup
			const res = gameService.playPowerup(gameId, "player1", "capacity_increase", nodeId);
			expect(res.success).toBe(true);
			const updatedNode = p1.programPreview.find((n) => n.id === nodeId);
			expect(updatedNode.capacity).toBe(2);
		});

		it("should apply bug to opponent preview node", () => {
			const gameId = "test-bugdebug";
			const playerA = { id: "A", username: "Alice" };
			const playerB = { id: "B", username: "Bob" };

			gameService.createGame(gameId, [playerA, playerB]);
			const game = gameService.getGame(gameId);
			const a = game.players.find((p) => p.id === "A");
			const b = game.players.find((p) => p.id === "B");

			// Enter building for both
			gameService.chooseBuild(gameId, "A");
			gameService.chooseBuild(gameId, "B");

			// Opponent (B) creates preview program
			const nodeId = "block-x";
			gameService.setProgramPreview(gameId, "B", [{ id: nodeId, card: "attack", children: [] }]);
			expect(b.programPreview[0].bugged).toBeFalsy();

			// Give A a bug powerup
			a.hand.push({ key: "bug", type: "powerup" });
			const bugRes = gameService.playPowerup(gameId, "A", "bug", nodeId);
			expect(bugRes.success).toBe(true);
			expect(b.programPreview[0].bugged).toBe(true);
		});

		it("should clear bug with debug powerup", () => {
			const gameId = "test-debug";
			const playerA = { id: "A", username: "Alice" };
			const playerB = { id: "B", username: "Bob" };

			gameService.createGame(gameId, [playerA, playerB]);
			const game = gameService.getGame(gameId);
			const a = game.players.find((p) => p.id === "A");
			const b = game.players.find((p) => p.id === "B");

			// Enter building for both
			gameService.chooseBuild(gameId, "A");
			gameService.chooseBuild(gameId, "B");

			// Opponent (B) creates preview program
			const nodeId = "block-x";
			gameService.setProgramPreview(gameId, "B", [{ id: nodeId, card: "attack", children: [] }]);

			// Give A a bug powerup and apply it
			a.hand.push({ key: "bug", type: "powerup" });
			gameService.playPowerup(gameId, "A", "bug", nodeId);
			expect(b.programPreview[0].bugged).toBe(true);

			// Give B a debug powerup to clear the bug
			b.hand.push({ key: "debug", type: "powerup" });
			const debugRes = gameService.playPowerup(gameId, "B", "debug", nodeId);
			expect(debugRes.success).toBe(true);
			expect(b.programPreview[0].bugged).toBe(false);
		});
	});

	describe("Program Node Limits", () => {
		it("should reject preview exceeding 5 total nodes including nested", () => {
			const gameId = "test-limit";
			const player1 = { id: "player1", username: "Alice" };
			const player2 = { id: "player2", username: "Bob" };

			gameService.createGame(gameId, [player1, player2]);
			const game = gameService.getGame(gameId);
			const p1 = game.players.find((p) => p.id === "player1");

			// Enter building phase
			const chooseRes = gameService.chooseBuild(gameId, "player1");
			expect(chooseRes.success).toBe(true);

			// Build preview with 6 nodes (1 root loop + 5 children)
			const preview = [
				{
					id: "root",
					card: "for_loop",
					children: [
						{ id: "c1", card: "attack" },
						{ id: "c2", card: "attack" },
						{ id: "c3", card: "attack" },
						{ id: "c4", card: "attack" },
						{ id: "c5", card: "attack" },
					],
				},
			];

			const res = gameService.setProgramPreview(gameId, "player1", preview);
			expect(res.success).toBe(false);
			expect(res.error).toMatch(/Preview exceeds/);
			expect(p1.programPreview).toBeNull();
		});
	});

	describe("Container Nesting Validation", () => {
		let gameId, game;

		beforeEach(() => {
			gameId = "nesting-test";
			const player1 = { id: "player1", username: "Player1" };
			const player2 = { id: "player2", username: "Player2" };
			game = gameService.createGame(gameId, [player1, player2]);
		});

		describe("Nested for_loop restrictions", () => {
			it("should reject nested for_loops", () => {
				const program = [
					{
						id: "outer-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 1,
						children: [
							{
								id: "inner-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Nested for_loops are not allowed");
			});

			it("should reject nested for_loops even with capacity 2", () => {
				const program = [
					{
						id: "outer-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 2,
						children: [
							{
								id: "inner-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Nested for_loops are not allowed");
			});

			it("should reject nested for_loops in setProgramPreview", () => {
				const player = game.players[0];
				player.turnPhase = "building";

				const preview = [
					{
						id: "outer-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 2,
						children: [
							{
								id: "inner-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [],
							},
						],
					},
				];

				const result = gameService.setProgramPreview(gameId, "player1", preview);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Nested for_loops are not allowed");
			});
		});

		describe("Nested if block restrictions", () => {
			it("should reject nested if blocks", () => {
				const program = [
					{
						id: "outer-if",
						card: "if",
						params: { condition: "hasEnergy(1)" },
						capacity: 1,
						children: [
							{
								id: "inner-if",
								card: "if",
								params: { condition: "hasEnergy(2)" },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Nested if blocks are not allowed");
			});

			it("should reject nested if blocks even with capacity 2", () => {
				const program = [
					{
						id: "outer-if",
						card: "if",
						params: { condition: "hasEnergy(1)" },
						capacity: 2,
						children: [
							{
								id: "inner-if",
								card: "if",
								params: { condition: "hasEnergy(2)" },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Nested if blocks are not allowed");
			});
		});

		describe("Mixed container nesting with capacity requirements", () => {
			it("should allow if inside for_loop when for_loop has capacity 2", () => {
				const program = [
					{
						id: "for-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 2,
						children: [
							{
								id: "if-block",
								card: "if",
								params: { condition: "hasEnergy(1)" },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(true);
				expect(result.game.players[0].program).toBeDefined();
			});

			it("should reject if inside for_loop when for_loop has capacity 1", () => {
				const program = [
					{
						id: "for-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 1,
						children: [
							{
								id: "if-block",
								card: "if",
								params: { condition: "hasEnergy(1)" },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Container blocks inside for_loop require capacity 2");
			});

			it("should allow for_loop inside if when if has capacity 2", () => {
				const program = [
					{
						id: "if-block",
						card: "if",
						params: { condition: "hasEnergy(1)" },
						capacity: 2,
						children: [
							{
								id: "for-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(true);
				expect(result.game.players[0].program).toBeDefined();
			});

			it("should reject for_loop inside if when if has capacity 1", () => {
				const program = [
					{
						id: "if-block",
						card: "if",
						params: { condition: "hasEnergy(1)" },
						capacity: 1,
						children: [
							{
								id: "for-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(false);
				expect(result.error).toBe("Container blocks inside if require capacity 2");
			});

			it("should allow regular cards in capacity 1 containers", () => {
				const program = [
					{
						id: "for-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 1,
						children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
					},
				];

				const result = gameService.setProgram(gameId, "player1", program);
				expect(result.success).toBe(true);
			});
		});

		describe("Capacity increase restrictions on nested containers", () => {
			it("should prevent capacity increase on nested container inside for_loop", () => {
				const player = game.players[0];
				player.turnPhase = "building";
				player.hand.push({ key: "capacity_increase", type: "powerup", name: "Capacity +" });

				const preview = [
					{
						id: "outer-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 2,
						children: [
							{
								id: "nested-if",
								card: "if",
								params: { condition: "hasEnergy(1)" },
								capacity: 1,
								children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
							},
						],
					},
				];

				gameService.setProgramPreview(gameId, "player1", preview);

				const result = gameService.playPowerup(gameId, "player1", "capacity_increase", "nested-if");
				expect(result.success).toBe(false);
				expect(result.error).toBe("Cannot increase capacity of nested container blocks");
			});

			it("should prevent capacity increase on nested for_loop inside if", () => {
				const player = game.players[0];
				player.turnPhase = "building";
				player.hand.push({ key: "capacity_increase", type: "powerup", name: "Capacity +" });

				const preview = [
					{
						id: "outer-if",
						card: "if",
						params: { condition: "hasEnergy(1)" },
						capacity: 2,
						children: [
							{
								id: "nested-loop",
								card: "for_loop",
								params: { count: 2 },
								capacity: 1,
								children: [],
							},
						],
					},
				];

				gameService.setProgramPreview(gameId, "player1", preview);

				const result = gameService.playPowerup(gameId, "player1", "capacity_increase", "nested-loop");
				expect(result.success).toBe(false);
				expect(result.error).toBe("Cannot increase capacity of nested container blocks");
			});

			it("should allow capacity increase on top-level containers", () => {
				const player = game.players[0];
				player.turnPhase = "building";
				player.hand.push({ key: "capacity_increase", type: "powerup", name: "Capacity +" });

				const preview = [
					{
						id: "top-level-loop",
						card: "for_loop",
						params: { count: 2 },
						capacity: 1,
						children: [{ id: "attack", card: "attack", params: { amount: 1 } }],
					},
				];

				gameService.setProgramPreview(gameId, "player1", preview);

				const result = gameService.playPowerup(gameId, "player1", "capacity_increase", "top-level-loop");
				expect(result.success).toBe(true);
				expect(player.programPreview[0].capacity).toBe(2);
			});
		});
	});
});
