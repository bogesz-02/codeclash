import vm from "node:vm";
import { cardsService } from "./cards.service.js";
import { gameService } from "./game.service.js";

// Executes player programs and applies game rules
class ExecutionService {
	// Build VM context with game API for code execution
	buildContext(game, playerId, logs, events, defenses = {}, isDryRun = false) {
		const player = game.players.find((p) => p.id === playerId);
		const opponent = game.players.find((p) => p.id !== playerId);

		// Track actions during execution
		const flags = {
			skipAttack: defenses.hasEnergyCard || false,
			hasHide: defenses.hasHide || false,
			dodgesRemaining: defenses.dodgesRemaining || 0,
			successAttackThisRound: false,
			totalDamageDealt: 0,
			totalHealingDone: 0,
			totalCardDraws: 0,
			energyGained: 0,
			opponentAttacked: defenses.opponentAttacked || false,
			damageTaken: defenses.damageTaken || 0,
		};

		// Logging utilities
		const log = (msg) => logs.push(String(msg));
		const addEvent = (icon, message, details = null, actorId = null, targetId = null) => {
			const event = { icon, message, details, actorId };
			if (targetId) event.targetId = targetId;
			events.push(event);
		};

		// API exposed to sandboxed code
		const api = {
			get energy() {
				return player.energy ?? 0;
			},
			set energy(val) {
				if (!isDryRun) {
					player.energy = Math.max(0, Number(val) || 0);
				}
			},
			get hp() {
				return player.hp ?? 10;
			},

			// Mark that attacks should be skipped
			markSkipAttack: () => {
				flags.skipAttack = true;
				flags.totalDamageDealt = 0;
				flags.successAttackThisRound = false;
			},

			// Check if player has sufficient energy
			hasEnergy: (amount) => {
				const required = Math.max(0, Number(amount) || 0);
				const current = player.energy ?? 0;
				const hasIt = current >= required;
				if (!hasIt) {
					log(`⚠️ Insufficient energy — need ${required}, have ${current}`);
					addEvent("⚡", `⚡{playerId} : nincs elég energia`, `Need ${required}, have ${current}`, playerId);
				}
				return hasIt;
			},

			// Conditional values for if cards
			get health_below_3() {
				return player.hp < 3;
			},
			get health_below_5() {
				return player.hp < 5;
			},
			get no_energy() {
				return (player.energy ?? 0) === 0;
			},
			get success_attack_this_round() {
				return flags.successAttackThisRound;
			},
			get opponent_attacked_this_round() {
				return flags.opponentAttacked;
			},
			get damage_taken_gt_0() {
				return flags.damageTaken > 0;
			},

			// Deal damage to opponent (defenses applied centrally)
			attack: (amount) => {
				const dmg = Math.max(0, Number(amount) || 0);

				if (flags.skipAttack) {
					log(`⚡ Cannot attack (energy card used)`);
					addEvent("⚡", "⚔️{playerId} : Támadás blokkolva (energia növekedés)", "Cannot attack when energy card is used", playerId);
					flags.lastAttackBlocked = true;
					return;
				}

				flags.totalDamageDealt += dmg;
				flags.successAttackThisRound = true;
				flags.lastAttackBlocked = false;
				log(`Attack for ${dmg} damage`);
			},

			// Restore HP (capped at 10, limited by energy in Phase 5)
			heal: (amount) => {
				const hp = Math.max(0, Number(amount) || 0);
				flags.totalHealingDone += hp;
				log(`Heal for ${hp} HP`);
			},

			// Gain energy and cancel all attacks this round
			gainEnergy: (amount) => {
				const inc = Math.max(0, Number(amount) || 0);
				if (!isDryRun) {
					player.energy = (player.energy ?? 0) + inc;
				}
				flags.skipAttack = true;
				flags.totalDamageDealt = 0;
				flags.successAttackThisRound = false;
				flags.energyGained = (flags.energyGained || 0) + inc;
				log(`Gained ${inc} energy - all attacks this round canceled`);
			},

			// Consume energy, return false if insufficient
			consumeEnergy: (amount) => {
				const dec = Math.max(0, Number(amount) || 0);
				const currentEnergy = player.energy ?? 0;

				if (flags.lastAttackBlocked) {
					log(`⚠️ Cannot consume energy (attack was blocked by energy card)`);
					flags.lastAttackBlocked = false;
					return false;
				}

				if (currentEnergy < dec) {
					log(`⚠️ Insufficient energy — need ${dec}, have ${currentEnergy}`);
					addEvent("⚠️", `⚡{playerId}: nincs elég energia`, null, playerId);
					return false;
				}
				if (!isDryRun) {
					player.energy = currentEnergy - dec;
				}
				log(`Consumed ${dec} energy (${currentEnergy} → ${player.energy})`);
				return true;
			},

			// Register defensive effects (dodge/hide)
			registerEffect: (name, payload) => {
				if (name === "dodge_one") {
					flags.dodgesRemaining = (flags.dodgesRemaining || 0) + 1;
					log(`Registered dodge (1 attack)`);
					addEvent("🛡️", `🛡️{playerId} : kitérés`, null, playerId);
				} else if (name === "dodge_all") {
					flags.hasHide = true;
					log(`Registered hide (all attacks)`);
					addEvent("🛡️", `🛡️{playerId} : elbújás`, null, playerId);
				}
			},

			// Request card draws (applied in Phase 5)
			draw: (count, options = {}) => {
				const drawCount = Math.max(0, Number(count) || 0);

				if (!isDryRun && drawCount > 0) {
					flags.totalCardDraws += drawCount;
					log(`Will draw ${drawCount} card(s)`);
				}
			},
			handSize: () => player.hand.length,
			handMax: () => 5,

			_flags: flags,
		};

		return api;
	}

	// Generate events from execution results
	generateNetEvents(player, opponent, game, flags, addEvent) {
		if (flags.energyGained > 0 && flags.totalDamageDealt === 0) {
			addEvent("⚡", "⚡{playerId}: energia növekedés", null, player.id);
		}

		if (flags.totalDamageDealt > 0) {
			addEvent("⚔️", "{playerId} ⚔️ {targetId}", null, player.id, opponent.id);
		}
	}

	// Remove bugged blocks from program tree
	filterBuggedBlocks(nodes) {
		if (!Array.isArray(nodes)) return [];
		return nodes
			.filter((node) => !node.bugged)
			.map((node) => ({
				...node,
				children: node.children ? this.filterBuggedBlocks(node.children) : undefined,
			}));
	}

	// Normalize program nodes (extract card keys, params)
	sanitizeNodes(nodes, logs) {
		if (!Array.isArray(nodes)) return [];
		const out = [];
		for (const n of nodes) {
			if (!n) continue;
			let cardVal = n.card;
			if (typeof cardVal === "object" && cardVal !== null) {
				cardVal = cardVal.key || cardVal.card || cardVal.name;
			}
			if (typeof cardVal !== "string" || !cardVal.trim()) {
				logs && logs.push(`Skipping node without valid card key (id=${n.id || "no-id"}, card=${JSON.stringify(n.card)})`);
				continue;
			}

			let params = n.params || {};
			if (typeof n.card === "object" && n.card !== null && n.card.params) {
				params = { ...n.card.params, ...params };
			}
			const sanitized = {
				id: n.id,
				card: cardVal,
				params: params,
				bugged: !!n.bugged,
				capacity: n.capacity,
			};
			if (Array.isArray(n.children) && n.children.length > 0) {
				sanitized.children = this.sanitizeNodes(n.children, logs);
			}
			out.push(sanitized);
		}
		return out;
	}

	// Execute player program in VM sandbox
	async execute(gameId, playerId, programTree, defenses = {}, isDryRun = false) {
		const game = gameService.getGame(gameId);
		if (!game) return { success: false, error: "Game not found" };

		const logs = [];
		const events = [];

		game.players.forEach((p) => {
			if (typeof p.energy !== "number") p.energy = 3;
			if (typeof p.hp !== "number") p.hp = 10;
			if (!Array.isArray(p.hand)) p.hand = [];
		});

		const sanitized = this.sanitizeNodes(programTree, logs);
		const cleanProgram = this.filterBuggedBlocks(sanitized);

		if (cleanProgram.length === 0) {
			logs.push("No executable code (all blocks bugged)");
			const addEventHelper = (icon, message, details = null, actorId = null) => {
				events.push({ icon, message, details, actorId });
			};
			addEventHelper("🐛", `${playerId.substring(0, 8)} has no executable code`, "All blocks are bugged");
			return { success: true, code: "", logs, events, game, defenses: { hasHide: false, dodgesRemaining: 0 } };
		}

		let code = "";
		try {
			const codeSegments = await Promise.all(cleanProgram.map((node) => cardsService.buildCode(node)));
			code = codeSegments.join("\n");
		} catch (err) {
			logs.push(`Code build failed: ${err.message}`);
			return { success: false, code: "", logs, events, game, error: err.message, defenses: { hasHide: false, dodgesRemaining: 0 } };
		}

		const context = this.buildContext(game, playerId, logs, events, defenses, isDryRun);
		const sandbox = Object.create(null);
		for (const [k, v] of Object.entries(context)) sandbox[k] = v;

		const script = new vm.Script(code, { filename: "card-program.js" });
		const vmContext = vm.createContext(sandbox, { name: "card-program" });

		try {
			script.runInContext(vmContext, { timeout: 1000 });

			if (!isDryRun) {
				const player = game.players.find((p) => p.id === playerId);
				const opponent = game.players.find((p) => p.id !== playerId);
				this.generateNetEvents(
					player,
					opponent,
					game,
					context._flags,
					context.addEvent ||
						((icon, msg, det, act, tgt) => {
							const evt = { icon, message: msg, details: det, actorId: act };
							if (tgt) evt.targetId = tgt;
							events.push(evt);
						})
				);
			}

			console.log(`[execute] Player ${playerId} events collected:`, events.length, events);
			console.log(`[execute] Player ${playerId} flags:`, context._flags);

			const allFlags = {
				hasHide: context._flags.hasHide,
				dodgesRemaining: context._flags.dodgesRemaining,
				attacked: context._flags.totalDamageDealt > 0,
				totalDamageDealt: context._flags.totalDamageDealt,
				successAttackThisRound: context._flags.successAttackThisRound,
				totalHealingDone: context._flags.totalHealingDone,
				totalCardDraws: context._flags.totalCardDraws,
				skipAttack: context._flags.skipAttack,
			};
			return { success: true, code, logs, events, game, flags: allFlags };
		} catch (error) {
			logs.push(`Execution error: ${error.message}`);
			const addEventHelper = (icon, message, details = null, actorId = null) => {
				events.push({ icon, message, details, actorId });
			};
			addEventHelper("❌", `${playerId.substring(0, 8)} execution failed`, error.message);
			return { success: false, code, logs, events, error: error.message, defenses: { hasHide: false, dodgesRemaining: 0 } };
		}
	}

	// Execute full round: both players, 5 phases
	async executeRound(gameId) {
		const game = gameService.getGame(gameId);
		if (!game) throw new Error("Game not found");

		const executionLogs = [];
		const allEvents = [];
		const addEvent = (icon, message, details = null, actorId = null, targetId = null) => {
			const event = { icon, message, details, actorId };
			if (targetId) event.targetId = targetId;
			allEvents.push(event);
		};

		// Phase 1: Scan programs for defensive/energy cards
		const defenses = {};
		for (const player of game.players) {
			defenses[player.id] = { hasHide: false, dodgesRemaining: 0, hasEnergyCard: false, attacked: false, damageTaken: 0 };

			const codeToScan = player.program || player.programPreview;
			if (codeToScan) {
				const scanCards = (nodes) => {
					if (!Array.isArray(nodes)) return;
					for (const node of nodes) {
						if (node.bugged) continue;
						const cardKey = typeof node.card === "string" ? node.card : node.card?.key || node.card?.card_key;
						if (cardKey === "hide") {
							defenses[player.id].hasHide = true;
						} else if (cardKey === "dodge") {
							defenses[player.id].dodgesRemaining++;
						} else if (cardKey === "energy") {
							defenses[player.id].hasEnergyCard = true;
						}
						if (node.children) scanCards(node.children);
					}
				};
				scanCards(codeToScan);
			}
		}

		// Phase 2: Set player defensive states
		for (const player of game.players) {
			player.hasHide = defenses[player.id].hasHide;
			player.dodgesRemaining = defenses[player.id].dodgesRemaining;
		}

		// Phase 3: Dry run both programs to see intended actions
		const pass1Results = {};

		for (const player of game.players) {
			const codeToExecute = player.program || player.programPreview;
			const hasValidCode = Array.isArray(codeToExecute) && codeToExecute.length > 0 && codeToExecute.every((node) => node && (node.card || node.key));

			if (hasValidCode) {
				const result = await this.execute(gameId, player.id, codeToExecute, defenses[player.id], true);
				pass1Results[player.id] = {
					attacked: result.flags?.totalDamageDealt > 0,
					damageDealt: result.flags?.totalDamageDealt || 0,
				};
			} else {
				pass1Results[player.id] = { attacked: false, damageDealt: 0 };
			}
		}

		// Phase 4: Real execution with opponent's actions visible
		const pass2Results = {};

		for (const player of game.players) {
			const opponent = game.players.find((p) => p.id !== player.id);
			const opponentPass1 = opponent ? pass1Results[opponent.id] : null;

			let actualDamageTaken = opponentPass1?.damageDealt || 0;
			if (defenses[player.id].hasHide) {
				actualDamageTaken = 0;
			} else if (defenses[player.id].dodgesRemaining > 0) {
				const blocked = Math.min(defenses[player.id].dodgesRemaining, actualDamageTaken);
				actualDamageTaken = Math.max(0, actualDamageTaken - blocked);
			}

			const executionFlags = {
				...defenses[player.id],
				opponentAttacked: opponentPass1?.attacked || false,
				opponentDamageDealt: opponentPass1?.damageDealt || 0,
				damageTaken: actualDamageTaken,
			};

			const codeToExecute = player.program || player.programPreview;
			const hasValidCode = Array.isArray(codeToExecute) && codeToExecute.length > 0 && codeToExecute.every((node) => node && (node.card || node.key));

			if (hasValidCode) {
				try {
					const result = await this.execute(gameId, player.id, codeToExecute, executionFlags, false);

					const rawDamage = result.flags?.totalDamageDealt || 0;
					let actualDamage = rawDamage;

					if (opponent && defenses[opponent.id].hasHide) {
						actualDamage = 0;
					} else if (opponent && defenses[opponent.id].dodgesRemaining > 0) {
						const blocked = Math.min(defenses[opponent.id].dodgesRemaining, actualDamage);
						actualDamage = Math.max(0, actualDamage - blocked);
					}

					pass2Results[player.id] = {
						damageDealt: actualDamage,
						healingDone: result.flags?.totalHealingDone || 0,
						cardDraws: result.flags?.totalCardDraws || 0,
					};
					console.log(`[Phase 4] Player ${player.id} results:`, pass2Results[player.id]);
					console.log(`[Phase 4] Player ${player.id} events:`, result.events?.length || 0, result.events);

					executionLogs.push({
						playerId: player.id,
						success: result.success,
						logs: result.logs || [],
						events: result.events || [],
						code: result.code,
					});

					if (result.events && result.events.length > 0) {
						console.log(`[Phase 4] Adding ${result.events.length} events to allEvents`);
						allEvents.push(...result.events);
					}
				} catch (err) {
					console.error(`[executeRound] Error for player ${player.id}:`, err);
					pass2Results[player.id] = { damageDealt: 0, healingDone: 0, cardDraws: 0 };
					executionLogs.push({
						playerId: player.id,
						success: false,
						logs: [`Execution failed: ${err.message}`],
						events: [{ icon: "❌", message: "Execution error", details: err.message }],
					});
				}
			} else {
				pass2Results[player.id] = { damageDealt: 0, healingDone: 0, cardDraws: 0 };
				executionLogs.push({
					playerId: player.id,
					success: true,
					logs: [],
					events: [],
					code: "",
				});
			}
		}

		// Phase 5: Apply HP changes and card draws simultaneously
		console.log("[Phase 5] pass2Results:", JSON.stringify(pass2Results, null, 2));
		for (const player of game.players) {
			const opponent = game.players.find((p) => p.id !== player.id);
			const myResults = pass2Results[player.id];
			const opponentResults = pass2Results[opponent.id];

			console.log(`[Phase 5] Player ${player.id}: healingDone=${myResults.healingDone}, current HP=${player.hp}`);
			const hpBeforeDamage = player.hp ?? 10;

			if (opponentResults.damageDealt > 0) {
				player.hp = Math.max(0, hpBeforeDamage - opponentResults.damageDealt);
				console.log(`[Phase 5] Player ${player.id}: Took ${opponentResults.damageDealt} damage, HP now ${player.hp}`);
			}

			if (myResults.healingDone > 0) {
				const currentHp = player.hp;
				const maxHp = 10;
				const hpNeeded = Math.max(0, maxHp - currentHp);
				const currentEnergy = player.energy ?? 0;

				const healingsUsed = Math.min(myResults.healingDone, hpNeeded, currentEnergy);

				if (healingsUsed > 0) {
					player.hp = Math.min(maxHp, currentHp + healingsUsed);
					console.log(`[Phase 5] Player ${player.id}: Healed ${healingsUsed} HP (from ${currentHp} to ${player.hp})`);

					player.energy = Math.max(0, currentEnergy - healingsUsed);
					console.log(`[Phase 5] Player ${player.id}: Consumed ${healingsUsed} energy for healing`);

					addEvent("💚", "💚{playerId}: gyógyítás", null, player.id);
				}
			}

			if (myResults.cardDraws > 0) {
				const handMax = 5;
				const emptySlots = Math.max(0, handMax - player.hand.length);
				const cardsToDraw = Math.min(myResults.cardDraws, emptySlots, game.deck.length);

				if (cardsToDraw > 0) {
					addEvent("🎴", "🎴{playerId} : húzás", null, player.id);
				}
				for (let i = 0; i < cardsToDraw; i++) {
					if (game.deck.length > 0 && player.hand.length < handMax) {
						player.hand.push(game.deck.shift());
					}
				}
			}
		}

		let gameOver = false;
		let winner = null;
		let loser = null;

		for (const player of game.players) {
			if (player.hp <= 0) {
				gameOver = true;
				loser = player;
				winner = game.players.find((p) => p.id !== player.id);
				break;
			}
		}

		const deduplicatedEvents = [];
		const eventKeys = new Set();
		for (const event of allEvents) {
			const key = `${event.icon}|${event.message}|${event.actorId || ""}`;
			if (!eventKeys.has(key)) {
				eventKeys.add(key);
				deduplicatedEvents.push(event);
			}
		}

		if (deduplicatedEvents.length === 0) {
			addEvent("ℹ️", "ℹ️Nem történt esemény", null);
			deduplicatedEvents.push(allEvents[allEvents.length - 1]);
		}

		console.log(`[executeRound] Final events (deduplicated):`, deduplicatedEvents.length, deduplicatedEvents);
		return { executionLogs, events: deduplicatedEvents, game, gameOver, winner, loser };
	}
}

export const executionService = new ExecutionService();
