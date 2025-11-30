class GameService {
	constructor() {
		this.games = new Map();
	}

	createGame(lobbyId, players) {
		const game = {
			id: lobbyId,
			players: players.map((p) => ({
				id: p.id,
				hand: [],
				hp: 10,
				energy: 3,
				attack: 1,
				score: 0,
				ready: false,
				program: null,
				programPreview: null,
				turnPhase: "choose", // 'choose', 'building', 'execution'
				hasDrawn: false,
			})),
			deck: [],
			currentPlayer: 0,
			state: "waiting",
			round: 1,
			createdAt: Date.now(),
		};

		this.games.set(lobbyId, game);
		return game;
	}

	getGame(gameId) {
		return this.games.get(gameId);
	}

	deleteGame(gameId) {
		this.games.delete(gameId);
	}

	// Check for_loop/if nesting rules (no nested for_loops, no nested ifs, containers need capacity 2)
	validateNesting(nodes, parentCard = null, parentCapacity = 0) {
		if (!Array.isArray(nodes)) return { valid: true };

		for (const node of nodes) {
			const cardKey = typeof node.card === "string" ? node.card : node.card?.key;
			const isContainer = cardKey === "for_loop" || cardKey === "if";

			if (isContainer && Array.isArray(node.children) && node.children.length > 0) {
				// Check for invalid nesting
				for (const child of node.children) {
					const childKey = typeof child.card === "string" ? child.card : child.card?.key;
					const childIsContainer = childKey === "for_loop" || childKey === "if";

					if (childIsContainer) {
						// Rule 1: No nested for_loops
						if (cardKey === "for_loop" && childKey === "for_loop") {
							return { valid: false, error: "Nested for_loops are not allowed" };
						}
						// Rule 2: No nested if blocks
						if (cardKey === "if" && childKey === "if") {
							return { valid: false, error: "Nested if blocks are not allowed" };
						}
						// Rule 3: Container inside container requires parent capacity 2
						if (node.capacity < 2) {
							return { valid: false, error: `Container blocks inside ${cardKey} require capacity 2` };
						}
					}
				}

				// Recursively validate children
				const childValidation = this.validateNesting(node.children, cardKey, node.capacity);
				if (!childValidation.valid) return childValidation;
			}
		}

		return { valid: true };
	}

	// Set player program (preserves bugged flags from preview)
	setProgram(gameId, playerId, program) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };
		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		const buggedMap = new Map();
		const extractBuggedState = (nodes) => {
			if (!Array.isArray(nodes)) return;
			nodes.forEach((n) => {
				if (n.bugged) buggedMap.set(n.id, true);
				if (n.children) extractBuggedState(n.children);
			});
		};
		if (player.programPreview) {
			extractBuggedState(player.programPreview);
		}

		const normalize = (nodes) => {
			if (!Array.isArray(nodes)) return [];
			return nodes.map((n) => ({
				id: n.id || `node-${Math.random().toString(36).slice(2)}`,
				card: typeof n.card === "object" && n.card !== null ? n.card.key || n.card.card || n.card.name : n.card,
				cardData: n.cardData ? { ...n.cardData } : undefined,
				params: (() => {
					let p = n.params || {};
					if (typeof n.card === "object" && n.card !== null && n.card.params) {
						p = { ...n.card.params, ...p };
					}
					return p;
				})(),
				capacity: typeof n.capacity === "number" ? n.capacity : n.baseCapacity || (n.card === "for_loop" || n.card === "if" ? 1 : undefined),
				bugged: buggedMap.has(n.id) || !!n.bugged,
				children: normalize(n.children),
			}));
		};
		player.program = normalize(program);
		player.programPreview = player.program;

		const countNodes = (nodes) => nodes.reduce((acc, n) => acc + 1 + (Array.isArray(n.children) ? countNodes(n.children) : 0), 0);
		if (countNodes(player.program) > 5) {
			// Revert program if invalid
			player.program = null;
			player.programPreview = null;
			return { success: false, error: "Program exceeds maximum of 5 total blocks" };
		}

		const nestingValidation = this.validateNesting(player.program);
		if (!nestingValidation.valid) {
			// Revert program if invalid
			player.program = null;
			player.programPreview = null;
			return { success: false, error: nestingValidation.error };
		}

		return { success: true, game };
	}

	setProgramPreview(gameId, playerId, program) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };
		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };
		if (player.ready) return { success: false, error: "Player already ready" };
		if (player.turnPhase !== "building") return { success: false, error: "Not in building phase" };
		const normalize = (nodes) => {
			if (!Array.isArray(nodes)) return [];
			return nodes.map((n) => ({
				id: n.id || `preview-${Math.random().toString(36).slice(2)}`,
				card: typeof n.card === "object" && n.card !== null ? n.card.key || n.card.card || n.card.name : n.card,
				cardData: n.cardData ? { ...n.cardData } : undefined,
				params: (() => {
					let p = n.params || {};
					if (typeof n.card === "object" && n.card !== null && n.card.params) {
						p = { ...n.card.params, ...p };
					}
					return p;
				})(),
				capacity: typeof n.capacity === "number" ? n.capacity : n.baseCapacity || (n.card === "for_loop" || n.card === "if" ? 1 : undefined),
				bugged: !!n.bugged,
				children: normalize(n.children),
			}));
		};
		player.programPreview = normalize(program);
		const countNodes = (nodes) => nodes.reduce((acc, n) => acc + 1 + (Array.isArray(n.children) ? countNodes(n.children) : 0), 0);
		if (countNodes(player.programPreview) > 5) {
			player.programPreview = null; // Clear invalid preview
			return { success: false, error: "Preview exceeds maximum of 5 total blocks" };
		}

		// Validate container nesting rules
		const nestingValidation = this.validateNesting(player.programPreview);
		if (!nestingValidation.valid) {
			player.programPreview = null;
			return { success: false, error: nestingValidation.error };
		}

		return { success: true, game };
	}

	setPlayerReady(gameId, playerId, ready) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };
		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };
		// If marking ready during building phase, ensure no empty container blocks
		if (ready && player.turnPhase === "building" && Array.isArray(player.program)) {
			const isContainerKey = (k) => ["for_loop", "if"].includes(k);
			const hasEmpty = (nodes) => {
				return nodes.some((n) => {
					if (isContainerKey(n.card) && (!Array.isArray(n.children) || n.children.length === 0)) return true;
					return Array.isArray(n.children) && hasEmpty(n.children);
				});
			};
			if (hasEmpty(player.program)) {
				return { success: false, error: "Cannot ready: empty for_loop/if block present" };
			}
		}
		player.ready = !!ready;
		return { success: true, game };
	}

	areAllPlayersReady(gameId) {
		const game = this.games.get(gameId);
		if (!game) return false;
		if (!Array.isArray(game.players) || game.players.length < 2) return false;
		return game.players.every((p) => {
			// Player must be marked ready
			if (!p.ready) return false;
			// Players can be ready without a program in any phase
			// (they either drew a card, or are skipping their turn)
			return true;
		});
	}

	// Reset ready states for next round (preserves programs with bugged flags)
	clearTurnState(gameId) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };

		const preserveBuggedFlags = (oldNodes) => {
			if (!Array.isArray(oldNodes)) return [];
			return oldNodes.filter(Boolean).map((n) => {
				const preserved = {
					id: n.id,
					card: n.card,
					cardData: n.cardData ? { ...n.cardData } : undefined,
					params: n.params || {},
					bugged: !!n.bugged,
					capacity: n.capacity,
				};
				if (Array.isArray(n.children) && n.children.length > 0) {
					preserved.children = preserveBuggedFlags(n.children);
				}
				return preserved;
			});
		};
		game.players.forEach((p) => {
			const preservedProgram = preserveBuggedFlags(p.program || p.programPreview || []);
			p.ready = false;
			p.program = preservedProgram; // Keep previous program for execution
			p.programPreview = preservedProgram; // Also set as preview
			p.turnPhase = "choose";
			p.hasDrawn = false;
		});
		game.round = (game.round || 1) + 1;
		return { success: true, game };
	}

	// Draw card from deck (player can't build this turn)
	drawCard(gameId, playerId) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };

		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		if (player.turnPhase !== "choose") {
			return { success: false, error: "Can only draw during choice phase" };
		}

		if (player.hasDrawn) {
			return { success: false, error: "Already drew this turn" };
		}

		if (player.hand.length >= 5) {
			return { success: false, error: "Hand is full" };
		}

		if (game.deck.length === 0) {
			return { success: false, error: "Deck is empty" };
		}

		const card = game.deck.pop();
		player.hand.push(card);
		player.hasDrawn = true;
		player.turnPhase = "drawn";

		return { success: true, game, card };
	}

	// Remove card from hand and add to discard pile
	discardCard(gameId, playerId, handIndex) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };

		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		if (!Array.isArray(player.hand)) player.hand = [];
		if (handIndex < 0 || handIndex >= player.hand.length) {
			return { success: false, error: "Invalid card index" };
		}

		const [discarded] = player.hand.splice(handIndex, 1);
		if (!Array.isArray(game.discard)) game.discard = [];
		game.discard.push(discarded);

		return { success: true, game, card: discarded };
	}

	// Switch player to building phase
	chooseBuild(gameId, playerId) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };

		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		if (player.turnPhase !== "choose") {
			return { success: false, error: "Can only choose during choice phase" };
		}

		player.turnPhase = "building";
		return { success: true, game };
	}

	initializeDeck(gameId) {
		const game = this.games.get(gameId);
		if (!game) {
			return { success: false, error: "Game not found" };
		}

		return { success: true, game };
	}

	dealCards(gameId) {
		const game = this.games.get(gameId);
		if (!game) {
			return { success: false, error: "Game not found" };
		}

		return { success: true, game };
	}

	playCard(gameId, playerId, card) {
		const game = this.games.get(gameId);
		if (!game) {
			return { success: false, error: "Game not found" };
		}

		return { success: true, game };
	}

	// Execute powerup card effect
	playPowerup(gameId, playerId, cardKey, targetBlockId) {
		const game = this.games.get(gameId);
		if (!game) return { success: false, error: "Game not found" };
		const player = game.players.find((p) => p.id === playerId);
		if (!player) return { success: false, error: "Player not found" };

		if (!Array.isArray(player.hand)) player.hand = [];
		// find card in hand by key (first occurrence)
		const handIndex = player.hand.findIndex((c) => c.key === cardKey);
		if (handIndex === -1) return { success: false, error: "Powerup not in hand" };
		const card = player.hand[handIndex];
		if (card.type !== "powerup") return { success: false, error: "Card is not a powerup" };

		const findNode = (nodes, id) => {
			for (const n of nodes || []) {
				if (n.id === id) return n;
				const child = findNode(n.children, id);
				if (child) return child;
			}
			return null;
		};

		const findInProgramOrPreview = (playerObj, id) => {
			if (!id) return null;
			let node = null;
			if (Array.isArray(playerObj.program)) {
				node = findNode(playerObj.program, id);
			}
			if (!node && Array.isArray(playerObj.programPreview)) {
				node = findNode(playerObj.programPreview, id);
			}
			return node;
		};

		const opponent = game.players.find((p) => p.id !== playerId);

		let effectApplied = false;
		switch (cardKey) {
			case "capacity_increase": {
				if (!targetBlockId) return { success: false, error: "Target required" };
				const target = findInProgramOrPreview(player, targetBlockId);
				if (!target) return { success: false, error: "Target block not found" };
				if (!["for_loop", "if"].includes(target.card)) return { success: false, error: "Invalid target for capacity increase" };
				if (target.capacity >= 2) return { success: false, error: "Already at max capacity" };

				const isNestedContainer = (nodes, targetId, parentIsContainer = false) => {
					for (const node of nodes || []) {
						const isContainer = node.card === "for_loop" || node.card === "if";
						if (node.id === targetId && parentIsContainer) return true;
						if (Array.isArray(node.children)) {
							const result = isNestedContainer(node.children, targetId, isContainer);
							if (result) return true;
						}
					}
					return false;
				};

				const programOrPreview = player.program || player.programPreview || [];
				if (isNestedContainer(programOrPreview, targetBlockId)) {
					return { success: false, error: "Cannot increase capacity of nested container blocks" };
				}

				target.capacity = 2;
				if (Array.isArray(player.program) && Array.isArray(player.programPreview)) {
					const programNode = findNode(player.program, targetBlockId);
					if (programNode && programNode !== target) programNode.capacity = 2;
				}
				effectApplied = true;
				break;
			}
			case "draw_from_opponent": {
				if (!opponent) return { success: false, error: "No opponent" };
				if (!Array.isArray(opponent.hand) || opponent.hand.length === 0) return { success: false, error: "Opponent hand empty" };
				const rand = Math.floor(Math.random() * opponent.hand.length);
				const [stolen] = opponent.hand.splice(rand, 1);
				if (player.hand.length >= 5) {
					if (!Array.isArray(game.discard)) game.discard = [];
					game.discard.push(stolen);
				} else {
					player.hand.push(stolen);
				}
				effectApplied = true;
				break;
			}
			case "opponent_discard": {
				if (!opponent) return { success: false, error: "No opponent" };
				if (!Array.isArray(opponent.hand) || opponent.hand.length === 0) return { success: false, error: "Opponent hand empty" };
				const rand = Math.floor(Math.random() * opponent.hand.length);
				const [discarded] = opponent.hand.splice(rand, 1);
				if (!Array.isArray(game.discard)) game.discard = [];
				game.discard.push(discarded);
				effectApplied = true;
				break;
			}
			case "bug": {
				if (!targetBlockId) return { success: false, error: "Target required" };
				if (!opponent) return { success: false, error: "No opponent" };
				const target = findInProgramOrPreview(opponent, targetBlockId);
				if (!target) return { success: false, error: "Target block not found" };
				if (target.bugged) return { success: false, error: "Already bugged" };

				const bugNode = (node) => {
					if (!node) return;
					node.bugged = true;
					if (Array.isArray(node.children)) {
						node.children.forEach(bugNode);
					}
				};

				bugNode(target);

				if (Array.isArray(opponent.program)) {
					const programNode = findNode(opponent.program, targetBlockId);
					if (programNode) bugNode(programNode);
				}
				if (Array.isArray(opponent.programPreview)) {
					const previewNode = findNode(opponent.programPreview, targetBlockId);
					if (previewNode) bugNode(previewNode);
				}

				effectApplied = true;
				break;
			}
			case "debug": {
				if (!targetBlockId) return { success: false, error: "Target required" };
				console.log(`[debug] Searching for block ${targetBlockId} in player's code`);
				console.log(`[debug] Player program:`, JSON.stringify(player.program, null, 2));
				console.log(`[debug] Player programPreview:`, JSON.stringify(player.programPreview, null, 2));
				const target = findInProgramOrPreview(player, targetBlockId);
				if (!target) return { success: false, error: "Target block not found" };
				console.log(`[debug] Found target block ${targetBlockId}, bugged:`, target.bugged, "card:", target.card);
				if (!target.bugged) return { success: false, error: "Block is not bugged" };

				const debugNode = (node) => {
					if (!node) return;
					node.bugged = false;
					if (Array.isArray(node.children)) {
						node.children.forEach(debugNode);
					}
				};

				debugNode(target);

				if (Array.isArray(player.program)) {
					const programNode = findNode(player.program, targetBlockId);
					if (programNode) debugNode(programNode);
				}
				if (Array.isArray(player.programPreview)) {
					const previewNode = findNode(player.programPreview, targetBlockId);
					if (previewNode) debugNode(previewNode);
				}

				effectApplied = true;
				break;
			}
			default:
				return { success: false, error: "Unknown powerup" };
		}

		if (!effectApplied) return { success: false, error: "Effect not applied" };

		player.hand.splice(handIndex, 1);
		if (!Array.isArray(game.discard)) game.discard = [];
		game.discard.push(card);

		return { success: true, game };
	}

	nextTurn(gameId) {
		const game = this.games.get(gameId);
		if (!game) {
			return { success: false, error: "Game not found" };
		}

		game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
		return { success: true, game };
	}
}

export const gameService = new GameService();
