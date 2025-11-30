import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executionService } from "../../src/services/execution.service.js";
import { gameService } from "../../src/services/game.service.js";
import { deckService } from "../../src/services/deck.service.js";

describe("ExecutionService - Integration Tests", () => {
	let testGame;
	let gameId;

	beforeEach(async () => {
		gameId = `test-game-${Date.now()}-${Math.random()}`;
		const deck = await deckService.buildDeck();

		testGame = {
			id: gameId,
			deck: deck,
			players: [
				{
					id: "player1",
					username: "Player One",
					hp: 10,
					energy: 3,
					hand: [],
					program: [],
					programPreview: [],
					hasHide: false,
					dodgesRemaining: 0,
					ready: false,
				},
				{
					id: "player2",
					username: "Player Two",
					hp: 10,
					energy: 3,
					hand: [],
					program: [],
					programPreview: [],
					hasHide: false,
					dodgesRemaining: 0,
					ready: false,
				},
			],
			round: 1,
			state: "in_progress",
		};

		gameService.games.set(gameId, testGame);
	});

	afterEach(() => {
		gameService.games.delete(gameId);
	});

	describe("Attack Card", () => {
		it("should deal 1 damage and consume 1 energy", async () => {
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(9);
			expect(testGame.players[0].energy).toBe(2);
		});

		it("should not attack when energy is 0", async () => {
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].energy = 0;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(0);
		});

		it("should deal 2 damage with 2 attack cards", async () => {
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(8);
			expect(testGame.players[0].energy).toBe(1);
		});
	});

	describe("Healing Card", () => {
		it("should heal 1 HP and consume 1 energy when HP < 10", async () => {
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].hp = 7;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(8);
			expect(testGame.players[0].energy).toBe(2);
		});

		it("should not heal when HP is 10", async () => {
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].hp = 10;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(3);
		});

		it("should not heal when energy is 0", async () => {
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].hp = 7;
			testGame.players[0].energy = 0;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(7);
			expect(testGame.players[0].energy).toBe(0);
		});

		it("should consume energy only for HP actually restored", async () => {
			const healCard = testGame.deck.find((c) => c.key === "healing");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			// Player 1 attacks once
			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			// Player 2 at 9 HP tries to heal 3 times (needs 1, wastes 2)
			testGame.players[1].hp = 9;
			testGame.players[1].program = [
				{
					id: "block-2",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-3",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-4",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			// Player 2: takes 1 damage (9→8), heals 2 HP to reach max (8→10)
			expect(testGame.players[1].hp).toBe(10);
			// Player 2: consumes only 2 energy (not 3)
			expect(testGame.players[1].energy).toBe(1);
		});

		it("should not consume energy when no healing occurs", async () => {
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].hp = 10;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(3);
		});
	});

	describe("Energy Card", () => {
		it("should gain 1 energy when energy < 3", async () => {
			const energyCard = testGame.deck.find((c) => c.key === "energy");

			testGame.players[0].energy = 1;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: energyCard.key,
					cardData: energyCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].energy).toBe(2);
		});

		it("should not gain energy when energy is 3", async () => {
			const energyCard = testGame.deck.find((c) => c.key === "energy");

			testGame.players[0].energy = 3;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: energyCard.key,
					cardData: energyCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].energy).toBe(3);
		});

		it("should gain energy and prevent player from attacking in same round", async () => {
			const energyCard = testGame.deck.find((c) => c.key === "energy");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			// Player 1 gains energy and tries to attack
			testGame.players[0].energy = 1;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: energyCard.key,
					cardData: energyCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			// Player 2 should not take damage
			expect(testGame.players[1].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(2);
		});
	});

	describe("Dodge Card", () => {
		it("should dodge 1 attack and consume 1 energy", async () => {
			const dodgeCard = testGame.deck.find((c) => c.key === "dodge");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			// Player 1 dodges
			testGame.players[0].program = [
				{
					id: "block-1",
					card: dodgeCard.key,
					cardData: dodgeCard,
					params: {},
					bugged: false,
				},
			];

			// Player 2 attacks once
			testGame.players[1].program = [
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(2);
		});

		it("should dodge only first attack when attacked twice", async () => {
			const dodgeCard = testGame.deck.find((c) => c.key === "dodge");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: dodgeCard.key,
					cardData: dodgeCard,
					params: {},
					bugged: false,
				},
			];

			testGame.players[1].program = [
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-3",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(9);
			expect(testGame.players[0].energy).toBe(2);
		});
	});

	describe("Hide Card", () => {
		it("should block all attacks and consume all energy", async () => {
			const hideCard = testGame.deck.find((c) => c.key === "hide");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: hideCard.key,
					cardData: hideCard,
					params: {},
					bugged: false,
				},
			];

			testGame.players[1].program = [
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-3",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(0);
		});

		it("should not activate when opponent does not attack", async () => {
			const hideCard = testGame.deck.find((c) => c.key === "hide");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: hideCard.key,
					cardData: hideCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(3);
		});
	});

	describe("For Loop - 2 Iterations", () => {
		it("should execute child card 2 times", async () => {
			const forLoopCard = testGame.deck.find((c) => c.key === "for_loop" && c.params?.count === 2);
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: forLoopCard.key,
					cardData: forLoopCard,
					params: forLoopCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(8);
			expect(testGame.players[0].energy).toBe(1);
		});
	});

	describe("For Loop - 3 Iterations", () => {
		it("should execute child card 3 times", async () => {
			const forLoopCard = testGame.deck.find((c) => c.key === "for_loop" && c.params?.count === 3);
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: forLoopCard.key,
					cardData: forLoopCard,
					params: forLoopCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(7);
			expect(testGame.players[0].energy).toBe(0);
		});
	});

	describe("For Loop - 4 Iterations with Energy Limit", () => {
		it("should stop at 3 attacks when energy runs out", async () => {
			const forLoopCard = testGame.deck.find((c) => c.key === "for_loop" && c.params?.count === 4);
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].program = [
				{
					id: "block-1",
					card: forLoopCard.key,
					cardData: forLoopCard,
					params: forLoopCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(7);
			expect(testGame.players[0].energy).toBe(0);
		});

		it("should stop healing when energy runs out during loop", async () => {
			const forLoopCard = testGame.deck.find((c) => c.key === "for_loop" && c.params?.count === 4);
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].hp = 5;
			testGame.players[0].energy = 2;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: forLoopCard.key,
					cardData: forLoopCard,
					params: forLoopCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: healCard.key,
							cardData: healCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			// Loop executes 4 heal attempts but energy limits to 2 heals
			// Iteration 1: heal (HP 5→6, Energy 2→1)
			// Iteration 2: heal (HP 6→7, Energy 1→0)
			// Iteration 3: no energy, can't heal
			// Iteration 4: no energy, can't heal
			expect(testGame.players[0].hp).toBe(7);
			expect(testGame.players[0].energy).toBe(0);
		});
	});

	describe("If Statement", () => {
		it("should execute child when condition is true", async () => {
			const ifCard = testGame.deck.find((c) => c.key === "if" && c.params?.condition === "health_below_5");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].hp = 4;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: ifCard.key,
					cardData: ifCard,
					params: ifCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(9);
			expect(testGame.players[0].energy).toBe(2);
		});

		it("should not execute child when condition is false", async () => {
			const ifCard = testGame.deck.find((c) => c.key === "if" && c.params?.condition === "health_below_5");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].hp = 10;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: ifCard.key,
					cardData: ifCard,
					params: ifCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-2",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[1].hp).toBe(10);
			expect(testGame.players[0].energy).toBe(3);
		});
	});

	describe("Event Deduplication", () => {
		it("should show only one insufficient energy event per player", async () => {
			const attackCard = testGame.deck.find((c) => c.key === "attack");
			const healCard = testGame.deck.find((c) => c.key === "healing");

			testGame.players[0].energy = 0;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-3",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			const result = await executionService.executeRound(gameId);

			const energyEvents = result.events.filter((e) => e.icon === "⚡" && e.actorId === testGame.players[0].id);
			expect(energyEvents.length).toBe(1);
		});

		it("should use placeholder in attack blocked event", async () => {
			const energyCard = testGame.deck.find((c) => c.key === "energy");
			const attackCard = testGame.deck.find((c) => c.key === "attack");

			testGame.players[0].energy = 1;
			testGame.players[0].program = [
				{
					id: "block-1",
					card: energyCard.key,
					cardData: energyCard,
					params: {},
					bugged: false,
				},
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			const result = await executionService.executeRound(gameId);

			const blockedEvent = result.events.find((e) => e.message.includes("Támadás blokkolva"));
			expect(blockedEvent).toBeDefined();
			expect(blockedEvent.message).toContain("{playerId}");
			expect(blockedEvent.message).not.toContain(testGame.players[0].id);
		});
	});

	describe("Complete Game Scenario", () => {
		it("should handle complex multi-turn battle", async () => {
			const forLoopCard = testGame.deck.find((c) => c.key === "for_loop" && c.params?.count === 2);
			const attackCard = testGame.deck.find((c) => c.key === "attack");
			const healCard = testGame.deck.find((c) => c.key === "healing");

			// Round 1: Both players attack
			testGame.players[0].program = [
				{
					id: "block-1",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			testGame.players[1].program = [
				{
					id: "block-2",
					card: attackCard.key,
					cardData: attackCard,
					params: {},
					bugged: false,
				},
			];

			await executionService.executeRound(gameId);

			expect(testGame.players[0].hp).toBe(9);
			expect(testGame.players[1].hp).toBe(9);

			// Round 2: Player 1 heals, Player 2 attacks in loop
			testGame.players[0].program = [
				{
					id: "block-3",
					card: healCard.key,
					cardData: healCard,
					params: {},
					bugged: false,
				},
			];

			testGame.players[1].program = [
				{
					id: "block-4",
					card: forLoopCard.key,
					cardData: forLoopCard,
					params: forLoopCard.params,
					capacity: 2,
					bugged: false,
					children: [
						{
							id: "block-5",
							card: attackCard.key,
							cardData: attackCard,
							params: {},
							bugged: false,
						},
					],
				},
			];

			await executionService.executeRound(gameId);

			// Player 1: takes 2 damage (9→7), heals 1 (7→8)
			expect(testGame.players[0].hp).toBe(8);
			// Player 2: no damage taken
			expect(testGame.players[1].hp).toBe(9);
		});
	});
});
