import { useEffect, useState, useRef } from "react";
import { uuidv4 } from "../utils/uuid";
import { useParams, useNavigate } from "react-router-dom";
import GameField from "../components/GameField";
import { useLobby } from "../context/LobbyContext";
import { useSocket } from "../context/SocketContext";

export const Game = () => {
	// Discard handler using instanceId
	const handleDiscard = (instanceId) => {
		setHand((prev) => prev.filter((c) => c.instanceId !== instanceId));
		if (socket) {
			// Find the index of the card with this instanceId in the current hand
			const handIndex = hand.findIndex((c) => c.instanceId === instanceId);
			socket.emit("game:discard", { gameId: lobbyId, handIndex }, (response) => {
				if (!response?.success) {
					console.error("[handleDiscard] Failed to sync hand removal:", response?.error);
				}
			});
		}
	};
	const { lobbyId } = useParams();
	const navigate = useNavigate();
	const { currentLobby } = useLobby();
	const { socket, connected } = useSocket();
	const { leaveLobby } = useLobby();
	const leftRef = useRef(false);

	console.log("[Game] Component mounted/updated. lobbyId from URL:", lobbyId, "currentLobby.id:", currentLobby?.id);

	// If we don't have the lobby for this route, go back to home when connected.
	useEffect(() => {
		if (connected && (!currentLobby || currentLobby.id !== lobbyId)) {
			navigate("/");
		}
	}, [connected, currentLobby, lobbyId, navigate]);

	const [opponentLeft, setOpponentLeft] = useState(false);
	const returnTimerRef = useRef(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [gameOver, setGameOver] = useState(false);
	const [gameResult, setGameResult] = useState(null); // { winner, loser }

	// Game state
	const [gamePlayers, setGamePlayers] = useState([]); // Track game player state (hp, energy, etc.)
	const [hand, setHand] = useState([]);
	const [codeBlocks, setCodeBlocks] = useState([]);
	const [opponentCodeBlocks, setOpponentCodeBlocks] = useState([]);
	const [turnPhase, setTurnPhase] = useState("choose"); // "choose", "building", or "execution"
	const [playerReady, setPlayerReady] = useState(false);
	const [opponentReady, setOpponentReady] = useState(false);
	const opponentReadyRef = useRef(false); // Ref to track opponent ready state without causing re-renders
	const [events, setEvents] = useState([]); // Event log for execution events
	const [hasDrawn, setHasDrawn] = useState(false);
	const [round, setRound] = useState(1); // Current round number
	// Card definitions for rendering opponent program
	const [allCards, setAllCards] = useState([]);
	const [cardMap, setCardMap] = useState({});

	// Use game players if available, fall back to lobby players
	const players = gamePlayers.length > 0 ? gamePlayers : Array.isArray(currentLobby?.players) ? currentLobby.players : [];

	// Find local player using socket.id, and opponent as the first other player
	const localPlayer = socket ? players.find((p) => p.id === socket.id) : undefined;
	const opponent = socket ? players.find((p) => p.id !== socket.id) : players[1] || players[0];

	// Update hand from backend state (backend now assigns instanceId)
	useEffect(() => {
		if (localPlayer && Array.isArray(localPlayer.hand)) {
			setHand(localPlayer.hand);
		}
	}, [localPlayer]);

	// Safe fallbacks if data isn't available yet
	const playerData = localPlayer ?? { id: socket?.id ?? "me-guest", hp: 10, attack: 1, energy: 3 };
	const opponentData = opponent ?? { id: "opponent-guest", hp: 10, attack: 1, energy: 3 };

	// Handler to leave the game (button click)
	const handleLeave = () => {
		// avoid double processing
		if (leftRef.current) return;
		leftRef.current = true;
		if (socket) {
			try {
				socket.emit("game:leave", { lobbyId });
			} catch (e) {
				// ignore
			}
		}
		// update context and navigate
		leaveLobby(lobbyId);
		navigate("/");
	};

	// Test state handlers
	const handleTestState1 = () => {
		if (!socket) return;
		socket.emit("game:test:setState", { gameId: lobbyId, testState: "test1" }, (response) => {
			if (!response?.success) {
				console.error("[handleTestState1] Failed:", response?.error);
			}
		});
	};

	const handleTestState2 = () => {
		if (!socket) return;
		socket.emit("game:test:setState", { gameId: lobbyId, testState: "test2" }, (response) => {
			if (!response?.success) {
				console.error("[handleTestState2] Failed:", response?.error);
			}
		});
	};

	// Silent leave (used for browser back/popstate) - emits and clears state but doesn't navigate
	const leaveSilent = () => {
		if (leftRef.current) return;
		leftRef.current = true;
		if (socket) {
			try {
				socket.emit("game:leave", { lobbyId });
			} catch (e) {}
		}
		leaveLobby(lobbyId);
	};

	// If user closes window, treat as leaving the game
	useEffect(() => {
		const onBeforeUnload = (e) => {
			if (socket) {
				try {
					socket.emit("game:leave", { lobbyId });
				} catch (err) {}
			}
			// no need to show prompt; just let it unload
		};

		window.addEventListener("beforeunload", onBeforeUnload);

		// Push a history state so we can intercept back navigation and show confirmation
		window.history.pushState({ inGame: true }, "");
		const handleDiscard = (instanceId) => {
			setHand((prev) => prev.filter((c) => c.instanceId !== instanceId));
			if (socket) {
				// Find the index of the card with this instanceId in the current hand
				const handIndex = hand.findIndex((c) => c.instanceId === instanceId);
				socket.emit("game:discard", { gameId: lobbyId, handIndex }, (response) => {
					if (!response?.success) {
						console.error("[handleDiscard] Failed to sync hand removal:", response?.error);
					}
				});
			}
		};

		const onPopState = (e) => {
			// If the state is ours (navigating back), open confirm modal instead of leaving immediately
			setConfirmOpen(true);
			// Re-push our state so user remains on the same page until they confirm/cancel
			window.history.pushState({ inGame: true }, "");
		};

		window.addEventListener("popstate", onPopState);

		return () => {
			window.removeEventListener("beforeunload", onBeforeUnload);
			window.removeEventListener("popstate", onPopState);
		};
	}, [socket, lobbyId, leaveLobby]);

	// Watch for opponent leaving (opponent removed from players list)
	useEffect(() => {
		const hasOpponent = Boolean(players.find((p) => p.id !== socket?.id));
		if (!hasOpponent && players.length > 0) {
			// opponent disappeared
			setOpponentLeft(true);
			// clear opponent UI
			// start return timer (5s)
			if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
			returnTimerRef.current = setTimeout(() => {
				// navigate back to lobby/home
				leaveLobby(lobbyId);
				navigate("/");
			}, 5000);
		} else if (hasOpponent) {
			// opponent present - only clear timer if opponent hasn't left
			if (!opponentLeft && returnTimerRef.current) {
				clearTimeout(returnTimerRef.current);
				returnTimerRef.current = null;
			}
		}
		// cleanup on unmount
		return () => {
			if (returnTimerRef.current) {
				clearTimeout(returnTimerRef.current);
				returnTimerRef.current = null;
			}
		};
	}, [players, socket, lobbyId, leaveLobby, navigate, opponentLeft]);

	// Load game state when game starts
	useEffect(() => {
		if (!socket || !currentLobby) return;

		// Helper: build UI blocks from normalized program nodes
		const buildBlocksFromProgram = (nodes) => {
			if (!Array.isArray(nodes)) return [];
			return nodes.filter(Boolean).map((n) => {
				// Prefer cardData from the node if available (includes full card info)
				const cardDef = n.cardData || cardMap[n.card] || allCards.find((c) => c.key === n.card) || { key: n.card, name: n.card, type: "unknown" };
				const isContainer = cardDef.key === "for_loop" || cardDef.key === "if";
				return {
					id: n.id || `op-${Math.random().toString(36).slice(2)}`,
					card: cardDef,
					children: isContainer ? buildBlocksFromProgram(n.children) : [],
					bugged: !!n.bugged,
					capacity: typeof n.capacity === "number" ? n.capacity : cardDef.base_capacity || cardDef.baseCapacity || (isContainer ? 1 : undefined),
				};
			});
		};
		const handleGameStarted = (data) => {
			const game = data.game;
			// Initialize round
			if (typeof game.round !== "undefined") setRound(game.round);
			// Set game players for tracking hp/energy/etc
			if (game.players) setGamePlayers(game.players);
			// Find my player in the game state
			const myPlayer = game.players.find((p) => p.id === socket.id);
			if (myPlayer && myPlayer.hand) {
				console.log("[handleGameStarted] Received hand:", myPlayer.hand);
				// Debug: Check for if/for_loop cards in hand
				myPlayer.hand.forEach((card) => {
					if (card.key === "if" || card.key === "for_loop") {
						console.log(`[handleGameStarted] ${card.key} card in hand:`, card);
						console.log(`[handleGameStarted] ${card.key} params:`, card.params);
					}
				});
				setHand(myPlayer.hand);
			}
		};
		const handleGameUpdated = (data) => {
			// Handle game state updates
			console.log("Game updated:", data);
			if (data.action === "powerup-played") {
				console.log("[Game] Powerup played event received:", data.payload);
			}
			// Action-based updates
			if (data.action === "player-ready" && data.payload) {
				if (data.payload.playerId === socket.id) {
					setPlayerReady(!!data.payload.ready);
				} else {
					const ready = !!data.payload.ready;
					setOpponentReady(ready);
					opponentReadyRef.current = ready; // Keep ref in sync
				}
			}

			// Update hand if game state includes updated player data
			if (data.game && socket) {
				// Update game players to keep hp/energy/etc in sync
				if (data.game.players) setGamePlayers(data.game.players);

				const myPlayer = data.game.players.find((p) => p.id === socket.id);
				if (myPlayer) {
					if (myPlayer.hand) setHand(myPlayer.hand);
					if (myPlayer.turnPhase) setTurnPhase(myPlayer.turnPhase);
					if (typeof myPlayer.hasDrawn !== "undefined") setHasDrawn(myPlayer.hasDrawn);
					if (typeof myPlayer.ready !== "undefined") setPlayerReady(myPlayer.ready);
				}

				// Update opponent ready state and program blocks
				const oppPlayer = data.game.players.find((p) => p.id !== socket.id);
				if (oppPlayer) {
					if (typeof oppPlayer.ready !== "undefined") {
						setOpponentReady(oppPlayer.ready);
						opponentReadyRef.current = oppPlayer.ready;
					}

					// Update opponent program/preview blocks
					// For powerup updates, always refresh to show bugged/capacity changes
					const shouldUpdate = data.action === "powerup-played" || (Array.isArray(oppPlayer.program) && oppPlayer.program.length > 0) || (Array.isArray(oppPlayer.programPreview) && oppPlayer.programPreview.length > 0);
					if (shouldUpdate) {
						// Prioritize submitted program over preview
						if (Array.isArray(oppPlayer.program) && oppPlayer.program.length > 0) {
							console.log("[Game] Updating opponent blocks from program:", oppPlayer.program);
							setOpponentCodeBlocks(buildBlocksFromProgram(oppPlayer.program));
						} else if (Array.isArray(oppPlayer.programPreview) && oppPlayer.programPreview.length > 0) {
							// Fall back to preview if no final program yet
							console.log("[Game] Updating opponent blocks from preview:", oppPlayer.programPreview);
							setOpponentCodeBlocks(buildBlocksFromProgram(oppPlayer.programPreview));
						}
					}
					// Don't clear blocks if opponent drew instead - keep showing their previous turn's code
				}
			}
		};

		const handleRoundResolved = (data) => {
			console.log("Round resolved:", data);

			// Add execution events to event log with round information
			if (data.events && Array.isArray(data.events)) {
				const eventsWithRound = data.events.map((event) => ({
					...event,
					round: data.round,
				}));
				setEvents((prev) => [...prev, ...eventsWithRound]);
			} // Update game state with new HP/energy/etc
			if (data.game && typeof data.game.round !== "undefined") {
				setRound(data.game.round);
			}

			// Update player states from game data (backend cleared ready/hasDrawn)
			if (data.game && socket) {
				// Update game players with new hp/energy/etc
				if (data.game.players) setGamePlayers(data.game.players);

				const myPlayer = data.game.players.find((p) => p.id === socket.id);
				if (myPlayer) {
					setHand(myPlayer.hand || []);
					setTurnPhase(myPlayer.turnPhase || "choose");
					setHasDrawn(myPlayer.hasDrawn || false);
					setPlayerReady(myPlayer.ready || false);
				}

				const oppPlayer = data.game.players.find((p) => p.id !== socket.id);
				if (oppPlayer) {
					setOpponentReady(oppPlayer.ready || false);
					opponentReadyRef.current = oppPlayer.ready || false;
				}
			}
			// DON'T clear opponent code - keep it visible until they start building next round
		};
		const handlePlayerDisconnected = (data) => {
			console.log("Player disconnected:", data);
			setOpponentLeft(true);
			// Start timer to return to home after 5 seconds
			returnTimerRef.current = setTimeout(() => {
				navigate("/");
			}, 5000);
		};

		const handleGameOver = (data) => {
			console.log("Game over:", data);
			setGameOver(true);
			setGameResult(data);
			// Start timer to return to lobby after 5 seconds
			returnTimerRef.current = setTimeout(() => {
				navigate("/");
			}, 5000);
		};

		const handleTestStateSet = (data) => {
			console.log("Test state set:", data);
			if (data.game) {
				setGamePlayers(data.game.players);
				setRound(data.game.round || 1);

				const myPlayer = data.game.players.find((p) => p.id === socket.id);
				if (myPlayer) {
					setHand(myPlayer.hand || []);
					setTurnPhase(myPlayer.turnPhase || "choose");
					setHasDrawn(myPlayer.hasDrawn || false);
					setPlayerReady(myPlayer.ready || false);
					setCodeBlocks([]);
				}

				const oppPlayer = data.game.players.find((p) => p.id !== socket.id);
				if (oppPlayer) {
					setOpponentReady(oppPlayer.ready || false);
					setOpponentCodeBlocks([]);
				}

				setEvents([]);
			}
		};

		socket.on("game:started", handleGameStarted);
		socket.on("game:updated", handleGameUpdated);
		socket.on("game:round:resolved", handleRoundResolved);
		socket.on("game:player-disconnected", handlePlayerDisconnected);
		socket.on("game:over", handleGameOver);
		socket.on("game:test:stateSet", handleTestStateSet);

		// Fetch current state in case we navigated after 'game:started' was emitted
		try {
			socket.emit("game:get", { gameId: lobbyId }, (res) => {
				if (res?.success && res.game) {
					// Set game players
					if (res.game.players) setGamePlayers(res.game.players);
					if (typeof res.game.round !== "undefined") setRound(res.game.round);

					const myPlayer = res.game.players.find((p) => p.id === socket.id);
					if (myPlayer) {
						setHand(myPlayer.hand || []);
						if (myPlayer.turnPhase) setTurnPhase(myPlayer.turnPhase);
						if (typeof myPlayer.hasDrawn !== "undefined") setHasDrawn(myPlayer.hasDrawn);
					}
					// Initialize opponent program if already present
					const oppPlayer = res.game.players.find((p) => p.id !== socket.id);
					if (oppPlayer && Array.isArray(oppPlayer.program) && oppPlayer.program.length > 0) {
						setOpponentCodeBlocks(buildBlocksFromProgram(oppPlayer.program));
					}
				}
			});
		} catch (_) {}

		return () => {
			socket.off("game:started", handleGameStarted);
			socket.off("game:updated", handleGameUpdated);
			socket.off("game:round:resolved", handleRoundResolved);
			socket.off("game:player-disconnected", handlePlayerDisconnected);
			socket.off("game:over", handleGameOver);
			socket.off("game:test:stateSet", handleTestStateSet);
			if (returnTimerRef.current) {
				clearTimeout(returnTimerRef.current);
			}
		};
	}, [socket, currentLobby]);

	// Fetch card definitions once for mapping opponent program nodes
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
				const res = await fetch(`${apiUrl}/api/cards`);
				const json = await res.json();
				if (json?.success && Array.isArray(json.cards) && !cancelled) {
					setAllCards(json.cards);
					const map = {};
					json.cards.forEach((c) => {
						map[c.key] = c;
					});
					setCardMap(map);
				}
			} catch (e) {
				console.error("[Game] Failed to fetch cards for opponent program render", e);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Validation: Check if a card can be placed in a position
	const canPlaceCard = (card, parentBlock = null) => {
		// Defensive: remove any undefined holes before checks
		if (Array.isArray(codeBlocks) && codeBlocks.some((b) => !b)) {
			setCodeBlocks(codeBlocks.filter(Boolean));
		}
		const effectiveBlocks = codeBlocks.filter(Boolean);
		// Max 5 top-level blocks
		if (!parentBlock && effectiveBlocks.length >= 5) {
			return false;
		}

		// If placing inside a container
		if (parentBlock) {
			const capacity = parentBlock.capacity || parentBlock.card?.baseCapacity || parentBlock.card?.base_capacity || 1;
			const currentChildren = Array.isArray(parentBlock.children) ? parentBlock.children.length : 0;

			// Check capacity
			if (currentChildren >= capacity) {
				return false;
			}

			// For loops cannot contain other for loops
			if (parentBlock.card?.key === "for_loop" && card.key === "for_loop") {
				return false;
			}
		}

		return true;
	};

	// Handle dropping a card from hand or moving a placed block
	const handleDropCard = (item, parentBlockIndex = null) => {
		console.log("[Game handleDropCard]", { item, parentBlockIndex, fromHand: item.fromHand });

		// Case 1: Dropping a card from hand
		if (item.fromHand) {
			const card = item.card;

			// Prevent powerup cards from being placed as code blocks
			if (card.type === "powerup") {
				console.log("[Game] Powerup cards cannot be placed as code blocks");
				return;
			}

			const isContainer = card.key === "for_loop" || card.key === "if";

			if (parentBlockIndex !== null) {
				// Dropping into a parent block
				console.log("[Game] Dropping card from hand into parent block", parentBlockIndex);
				// Guard against stale / out-of-range index
				const compactBlocks = codeBlocks.filter(Boolean);
				if (compactBlocks.length !== codeBlocks.length) {
					console.warn("[Game] Compacted codeBlocks (removed undefined entries)");
					setCodeBlocks(compactBlocks);
				}
				if (parentBlockIndex < 0 || parentBlockIndex >= compactBlocks.length) {
					console.error("[Game] Invalid parentBlockIndex", parentBlockIndex, "compact length", compactBlocks.length);
					return;
				}
				const parentBlock = compactBlocks[parentBlockIndex];
				if (!parentBlock) {
					console.error("[Game] parentBlock undefined at index", parentBlockIndex, "after compaction");
					return;
				}

				if (!canPlaceCard(card, parentBlock)) {
					console.log("Cannot place card: parent limit reached or invalid nesting");
					return;
				}

				// Debug: Check if params are present on the card
				if (card.key === "if" || card.key === "for_loop") {
					console.log(`[handleDropCard] Creating block for ${card.key}, card.params:`, card.params);
					console.log(`[handleDropCard] Full card object:`, card);
				}

				// Initialize capacity for containers (how many nested elements allowed)
				const initialCapacity = isContainer ? card.baseCapacity || card.base_capacity || 1 : undefined;

				// For for_loop cards, preserve params (like count for iterations) and displayText from database
				const cardWithParams =
					card.key === "for_loop"
						? {
								...card,
								params: { ...card.params }, // Preserve original params from database
								displayText: card.displayText || `${card.params?.count || 1}x ismétlés`,
							}
						: card;

				const newBlock = {
					id: `block-${Date.now()}-${Math.random()}`,
					card: cardWithParams,
					children: isContainer ? [] : [], // always an array for simpler logic
					capacity: initialCapacity,
					disabled: false,
				};
				const updated = compactBlocks.map((b, i) =>
					i === parentBlockIndex
						? {
								...parentBlock,
								children: [...(Array.isArray(parentBlock.children) ? parentBlock.children : []), newBlock],
							}
						: b,
				);
				setCodeBlocks(updated);
			} else {
				// Dropping at top level
				if (!canPlaceCard(card)) {
					console.log("Cannot place card: limit reached");
					return;
				}

				// Initialize capacity for containers (how many nested elements allowed)
				const initialCapacity = isContainer ? card.baseCapacity || card.base_capacity || 1 : undefined;

				// For for_loop cards, preserve params (like count for iterations) and displayText from database
				const cardWithParams =
					card.key === "for_loop"
						? {
								...card,
								params: { ...card.params }, // Preserve original params from database
								displayText: card.displayText || `${card.params?.count || 1}x ismétlés`,
							}
						: card;

				const newBlock = {
					id: `block-${Date.now()}-${Math.random()}`,
					card: cardWithParams,
					children: isContainer ? [] : [],
					capacity: initialCapacity,
					disabled: false,
				};

				setCodeBlocks([...codeBlocks.filter(Boolean), newBlock]);
			}

			// Remove from hand
			setHand(hand.filter((c) => c.instanceId !== item.card.instanceId));
			if (socket) {
				// Find the index of the card with this instanceId in the current hand
				const handIndex = hand.findIndex((c) => c.instanceId === item.card.instanceId);
				socket.emit("game:discard", { gameId: lobbyId, handIndex }, (response) => {
					if (!response?.success) {
						console.error("[handleDropCard] Failed to sync hand removal:", response?.error);
					}
				});
			}
		}
		// Case 2: Moving an already placed block
		else if (item.block) {
			const blockToMove = item.block;
			const fromParentIndex = item.parentIndex;
			// Ensure children array exists for safety
			if (blockToMove && !Array.isArray(blockToMove.children)) {
				blockToMove.children = [];
			}

			let fromIndex;
			// If moving from nested position, use the child index directly
			// If moving from top-level, find actual index by ID
			if (fromParentIndex !== null && fromParentIndex !== undefined) {
				fromIndex = item.index; // This is the child index within parent's children array
			} else {
				// Find the actual current index of the block by ID (more reliable than using the cached index)
				const actualFromIndex = codeBlocks.findIndex((b) => b.id === blockToMove.id);
				fromIndex = actualFromIndex >= 0 ? actualFromIndex : item.index;
			}

			console.log("[Game] Moving placed block", {
				cachedFromIndex: item.index,
				fromIndex: fromIndex,
				blockId: blockToMove.id?.substring(0, 10),
				blockName: blockToMove.card?.name,
				fromParentIndex: item.parentIndex,
				toParentIndex: parentBlockIndex,
				currentCodeBlocks: codeBlocks.length,
				isNested: fromParentIndex !== null && fromParentIndex !== undefined,
			});

			// Prevent dropping a block into itself
			if (fromParentIndex === null && fromIndex === parentBlockIndex) {
				console.log("[Game] Cannot drop block into itself!");
				return;
			}

			// Step 1: Remove from source location
			let updated;
			if (fromParentIndex !== null && fromParentIndex !== undefined) {
				// Remove from nested position - use block ID to find the child
				console.log("[Game] Removing from nested position in parent", fromParentIndex, "block ID:", blockToMove.id);
				const sourceParent = codeBlocks[fromParentIndex];
				console.log("[Game] Source parent:", sourceParent?.card?.name, "children before:", sourceParent?.children?.map((c) => c.card?.name).join(", "));

				updated = codeBlocks.map((block, i) => {
					if (i === fromParentIndex) {
						// Filter by block ID, not index
						const newChildren = block.children.filter((child) => child.id !== blockToMove.id);
						console.log("[Game] Children after removal:", newChildren.map((c) => c.card?.name).join(", "));
						return {
							...block,
							children: newChildren,
						};
					}
					return block;
				});
			} else {
				// Remove from top level - this changes indices
				console.log("[Game] Removing from top level position", fromIndex);
				updated = codeBlocks.filter((_, i) => i !== fromIndex);
			}
			console.log("[Game] After removal, blocks count:", updated.length);
			console.log("[Game] Blocks after removal:", updated.map((b, i) => `${i}: ${b.card?.name} (children: ${b.children?.length || 0})`).join(", "));

			// Step 2: Add to target location
			if (parentBlockIndex !== null) {
				// Moving into a parent block
				console.log("[Game] Adding to parent block (original index):", parentBlockIndex);
				console.log("[Game] Source was from parent:", fromParentIndex, "at child index:", fromIndex);
				console.log("[Game] Block being moved:", blockToMove.card?.name, "(id:", blockToMove.id?.substring(0, 10) + ")");

				// Calculate adjusted index based on where we removed from
				let adjustedParentIndex = parentBlockIndex;

				// Only adjust if we removed from top level (not from a nested position)
				if (fromParentIndex === null || fromParentIndex === undefined) {
					// We removed a top-level block, which shifts indices
					// If the parent is AFTER the removed block, shift index down by 1
					if (parentBlockIndex > fromIndex) {
						adjustedParentIndex = parentBlockIndex - 1;
						console.log("[Game] Parent was after removed block, adjusted from", parentBlockIndex, "to", adjustedParentIndex);
					} else {
						console.log("[Game] Parent was before or same as removed block, no adjustment needed");
					}
				} else {
					console.log("[Game] Removed from nested position, no index adjustment needed");
				}

				console.log("[Game] Looking for target parent at adjusted index:", adjustedParentIndex);
				console.log("[Game] Updated array length:", updated.length);
				console.log("[Game] Updated array:", updated.map((b, i) => `${i}: ${b.card?.name}`).join(", "));

				const targetParent = updated[adjustedParentIndex];
				console.log("[Game] Target parent found:", targetParent?.card?.name, "children before add:", targetParent?.children?.map((c) => c.card?.name).join(", ") || "none");

				if (!targetParent) {
					console.error("[Game] ERROR: Target parent not found at index", adjustedParentIndex);
					console.error("[Game] Available indices: 0 to", updated.length - 1);
					return;
				}

				if (!canPlaceCard(blockToMove.card, targetParent)) {
					console.log("Cannot move block: parent limit reached or invalid nesting");
					return;
				}

				updated = updated.map((block, i) => {
					if (i === adjustedParentIndex) {
						const newChildren = [...(block.children || []), blockToMove];
						console.log("[Game] Adding block", blockToMove.card?.name, "to parent at index", i);
						console.log("[Game] Children after add:", newChildren.map((c) => c.card?.name).join(", "));
						return {
							...block,
							children: newChildren,
						};
					}
					return block;
				});
			} else {
				// Moving to top level
				console.log("[Game] Adding to top level");
				updated = [...updated, blockToMove];
			}

			console.log("[Game] Final blocks count:", updated.length);
			setCodeBlocks(updated);
		}
	};

	// Handle reordering code blocks
	const handleReorder = (fromIndex, toIndex) => {
		const updated = [...codeBlocks];
		const [moved] = updated.splice(fromIndex, 1);
		updated.splice(toIndex, 0, moved);
		setCodeBlocks(updated);
	};

	// Remove a top-level code block from the panel
	const handleRemoveBlock = (index) => {
		setCodeBlocks((prev) => prev.filter((_, i) => i !== index));
	};

	// Remove a nested block from a parent container
	const handleRemoveNested = (parentIndex, childIndex) => {
		console.log("[Game handleRemoveNested]", { parentIndex, childIndex });
		setCodeBlocks((prev) => {
			const updated = [...prev];
			const parent = updated[parentIndex];
			updated[parentIndex] = {
				...parent,
				children: parent.children.filter((_, i) => i !== childIndex),
			};
			return updated;
		});
	};

	// Discard a card from hand
	const handleDiscardCard = (index) => {
		if (!socket) return;
		// Optimistic update
		setHand((prev) => prev.filter((_, i) => i !== index));
		socket.emit("game:discard", { gameId: lobbyId, handIndex: index }, (response) => {
			if (!response?.success) {
				console.error("Discard failed:", response?.error);
				// TODO: Optionally refetch hand from server on failure
			}
		});
	};

	// Draw a card from deck
	const handleDrawCard = () => {
		console.log("[handleDrawCard] Called. socket:", !!socket, "hasDrawn:", hasDrawn, "hand.length:", hand.length, "turnPhase:", turnPhase);

		if (!socket) {
			console.error("[handleDrawCard] No socket!");
			return;
		}
		if (hasDrawn) {
			console.log("[handleDrawCard] Already drew this turn");
			return;
		}
		if (hand.length >= 5) {
			console.log("[handleDrawCard] Hand is full");
			return;
		}

		console.log("[handleDrawCard] Emitting game:draw event for gameId:", lobbyId);
		socket.emit("game:draw", { gameId: lobbyId }, (response) => {
			console.log("[handleDrawCard] Response received:", response);
			if (response.success) {
				console.log("[handleDrawCard] Success. Waiting for server state sync.");
				// Rely on server 'game:updated' and 'player-ready' for state; avoid double-setting local state
			} else {
				console.error("[handleDrawCard] Failed to draw:", response.error);
			}
		});
	};

	// Choose to build code instead of drawing
	const handleChooseBuild = () => {
		if (!socket || turnPhase !== "choose") return;

		socket.emit("game:choose:build", { gameId: lobbyId }, (response) => {
			if (response.success) {
				setTurnPhase("building");
				console.log("Chose to build");
			} else {
				console.error("Failed to choose build:", response.error);
			}
		});
	};

	// Submit code and mark ready
	const handleReady = () => {
		if (!socket || playerReady) return;

		// Frontend validation: block readiness if any empty container exists
		const isContainer = (b) => b && b.card && ["for_loop", "if"].includes(b.card.key || b.card.card_key);
		const hasEmpty = (b) => {
			if (!b) return false;
			if (isContainer(b) && (!Array.isArray(b.children) || b.children.length === 0)) return true;
			return Array.isArray(b.children) && b.children.some((c) => hasEmpty(c));
		};
		const emptyExists = Array.isArray(codeBlocks) && codeBlocks.some((b) => hasEmpty(b));
		if (emptyExists) {
			console.warn("[handleReady] Cannot mark ready: empty for/if container detected.");
			return; // Do not proceed
		}

		// Build program tree from code blocks
		const buildNode = (b) => {
			const node = {
				id: b.id,
				card: b.card.key || b.card.cardId,
				cardData: {
					key: b.card.key,
					name: b.card.name,
					displayText: b.card.displayText,
					description: b.card.description,
					type: b.card.type,
					rarity: b.card.rarity,
					baseCapacity: b.card.baseCapacity || b.card.base_capacity,
					variationKey: b.card.variationKey,
				},
				params: b.card.params || {},
				capacity: b.capacity || b.card?.baseCapacity || b.card?.base_capacity || undefined,
				bugged: !!b.disabled,
				children: Array.isArray(b.children) ? b.children.map((c) => buildNode(c)) : [],
			};

			// Debug logging for if/for_loop cards
			if (b.card.key === "if" || b.card.key === "for_loop") {
				console.log(`[buildNode] ${b.card.key} card block:`, b);
				console.log(`[buildNode] ${b.card.key} card.params:`, b.card.params);
				console.log(`[buildNode] ${b.card.key} resulting node.params:`, node.params);
			}

			return node;
		};
		const programTree = codeBlocks.map((b) => buildNode(b));

		// Emit program to server
		socket.emit("game:program:submit", { gameId: lobbyId, program: programTree }, (response) => {
			if (response.success) {
				console.log("Program submitted");
			}
		});

		// Mark ready
		socket.emit("game:turn:ready", { gameId: lobbyId, ready: true }, (response) => {
			if (response.success) {
				setPlayerReady(true);
				console.log("Marked ready");
			}
		});
	};

	// Play a powerup (non-targeted via button OR targeted via drag)
	const handlePlayPowerup = (card, handIndex = null, targetBlockId = null) => {
		if (!socket) {
			console.error("[Game handlePlayPowerup] No socket!");
			return;
		}
		console.log("[Game handlePlayPowerup] Playing powerup", { key: card?.key, targetBlockId, gameId: lobbyId, handIndex });
		// Optimistic hand removal if we know index
		if (handIndex !== null && handIndex >= 0) {
			console.log("[Game handlePlayPowerup] Removing card from hand at index", handIndex);
			setHand((prev) => prev.filter((_, i) => i !== handIndex));
		}
		console.log("[Game handlePlayPowerup] Emitting game:powerup:play");
		socket.emit("game:powerup:play", { gameId: lobbyId, cardKey: card.key, targetBlockId }, (res) => {
			console.log("[Game handlePlayPowerup] Server response:", res);
			if (!res?.success) {
				console.error("[Game] Powerup failed:", res?.error);
				// Re-add card on failure
				if (handIndex !== null && handIndex >= 0) {
					setHand((prev) => {
						const restored = [...prev];
						restored.splice(handIndex, 0, card);
						return restored;
					});
				}
				return;
			}

			// Update hand from server response (includes stolen card for draw_from_opponent)
			if (res.game && socket) {
				const myPlayer = res.game.players.find((p) => p.id === socket.id);
				if (myPlayer && myPlayer.hand) {
					setHand(myPlayer.hand);
				}
			}

			// If capacity increase applied, reflect locally (recursive search)
			if (card.key === "capacity_increase" && targetBlockId) {
				const upgrade = (nodes) =>
					nodes.map((n) => {
						if (!n) return n;
						if (n.id === targetBlockId) {
							// Only upgrade if container type
							if (["for_loop", "if"].includes(n.card?.key) && (n.capacity || n.card?.baseCapacity || n.card?.base_capacity) < 2) {
								// capacity_increase only affects capacity (nested elements), not params.count (iterations)
								return { ...n, capacity: 2 };
							}
							return n;
						}
						if (Array.isArray(n.children) && n.children.length > 0) {
							return { ...n, children: upgrade(n.children) };
						}
						return n;
					});
				setCodeBlocks((prev) => upgrade(prev));
			}
			// Bug: apply bugged flag recursively in opponent blocks
			if (card.key === "bug" && targetBlockId) {
				const applyBug = (nodes) =>
					nodes.map((n) => {
						if (!n) return n;
						if (n.id === targetBlockId) {
							return { ...n, bugged: true };
						}
						if (Array.isArray(n.children) && n.children.length > 0) {
							return { ...n, children: applyBug(n.children) };
						}
						return n;
					});
				setOpponentCodeBlocks((prev) => applyBug(prev));
			}
			// Debug: clear bugged flag recursively in own blocks
			if (card.key === "debug" && targetBlockId) {
				const clearBugRecursive = (node) => {
					const updated = { ...node, bugged: false };
					if (Array.isArray(node.children) && node.children.length > 0) {
						updated.children = node.children.map(clearBugRecursive);
					}
					return updated;
				};
				const clearBug = (nodes) =>
					nodes.map((n) => {
						if (!n) return n;
						if (n.id === targetBlockId) {
							return clearBugRecursive(n);
						}
						if (Array.isArray(n.children) && n.children.length > 0) {
							return { ...n, children: clearBug(n.children) };
						}
						return n;
					});
				setCodeBlocks((prev) => clearBug(prev));
			}
		});
	};

	// Confirmation handlers
	const handleConfirmOpen = () => setConfirmOpen(true);
	const handleConfirmCancel = () => setConfirmOpen(false);
	const handleConfirmLeave = (confirmed) => {
		if (confirmed) {
			handleLeave();
		}
		setConfirmOpen(false);
	};

	// If opponentLeft, hide opponentData so UI removes that side
	const visibleOpponent = opponentLeft ? undefined : opponentData;

	// Convert opponent program (if included in game updates) into blocks lazily when game updates supply program
	useEffect(() => {
		// This effect could listen for game updates with programs if we extend game:updated elsewhere
	}, []);

	// Emit live preview of building program whenever codeBlocks change during building phase and not yet ready
	useEffect(() => {
		if (!socket) return;
		if (turnPhase !== "building") return;
		if (playerReady) return; // don't emit after ready
		console.log("[Game] codeBlocks changed, current state:", JSON.stringify(codeBlocks, null, 2));

		// Debug: Check params on blocks before building nodes
		codeBlocks.forEach((b) => {
			if (b && (b.card?.key === "if" || b.card?.key === "for_loop")) {
				console.log(`[preview buildNode] Block ${b.card.key} - b.card.params:`, b.card.params);
			}
		});

		const buildNode = (b) => ({
			id: b.id,
			card: b.card.key || b.card.cardId,
			cardData: {
				key: b.card.key,
				name: b.card.name,
				displayText: b.card.displayText,
				description: b.card.description,
				type: b.card.type,
				rarity: b.card.rarity,
				baseCapacity: b.card.baseCapacity || b.card.base_capacity,
				variationKey: b.card.variationKey,
			},
			// Preserve params from database, don't recalculate
			params: b.card.params || {},
			capacity: b.capacity || b.card?.baseCapacity || b.card?.base_capacity || undefined,
			bugged: !!b.bugged,
			children: Array.isArray(b.children) ? b.children.map((c) => buildNode(c)) : [],
		});
		const programTree = codeBlocks.filter(Boolean).map((b) => buildNode(b));
		console.log("[Game] Emitting program preview:", JSON.stringify(programTree, null, 2));
		socket.emit("game:program:preview", { gameId: lobbyId, program: programTree });
	}, [socket, codeBlocks, turnPhase, playerReady, lobbyId]);

	// Listen for program preview updates (both opponent's and own for powerup effects)
	useEffect(() => {
		if (!socket) return;
		const handlePreviewUpdate = ({ playerId, programPreview, isPowerupUpdate }) => {
			const transform = (nodes) => {
				if (!Array.isArray(nodes)) return [];
				return nodes.filter(Boolean).map((n) => {
					const cardDef = cardMap[n.card] || allCards.find((c) => c.key === n.card) || { key: n.card, name: n.card, type: "unknown" };
					const isContainer = cardDef.key === "for_loop" || cardDef.key === "if";
					return {
						id: n.id || `prev-${Math.random().toString(36).slice(2)}`,
						card: cardDef,
						children: isContainer ? transform(n.children) : [],
						bugged: !!n.bugged,
						capacity: typeof n.capacity === "number" ? n.capacity : cardDef.base_capacity || cardDef.baseCapacity || (isContainer ? 1 : undefined),
					};
				});
			};

			if (playerId === socket.id) {
				// Only update own codeBlocks if this is a powerup update (to avoid infinite loop)
				if (isPowerupUpdate) {
					setCodeBlocks(transform(programPreview));
				}
				// Otherwise ignore to prevent loop with preview emission useEffect
			} else {
				// Opponent preview update
				// For powerup updates, always update to show bugged/capacity changes
				// For regular updates, only update if opponent hasn't clicked ready yet
				if (!isPowerupUpdate && opponentReadyRef.current) return;
				setOpponentCodeBlocks(transform(programPreview));
			}
		};
		socket.on("game:program:preview:update", handlePreviewUpdate);
		return () => {
			socket.off("game:program:preview:update", handlePreviewUpdate);
		};
	}, [socket, cardMap, allCards]);
	return (
		<GameField
			player={playerData}
			opponent={visibleOpponent}
			onLeave={handleLeave}
			opponentLeft={opponentLeft}
			gameOver={gameOver}
			gameResult={gameResult}
			myId={socket?.id}
			confirmOpen={confirmOpen}
			onOpenConfirm={handleConfirmOpen}
			onConfirmLeave={handleConfirmLeave}
			onCancelLeave={handleConfirmCancel}
			// Pass game state
			hand={hand}
			codeBlocks={codeBlocks}
			opponentCodeBlocks={opponentCodeBlocks}
			playerReady={playerReady}
			events={events}
			opponentReady={opponentReady}
			turnPhase={turnPhase}
			hasDrawn={hasDrawn}
			round={round}
			onDropCard={handleDropCard}
			onReorder={handleReorder}
			onRemoveBlock={handleRemoveBlock}
			onRemoveNested={handleRemoveNested}
			onReady={handleReady}
			onDrawCard={handleDrawCard}
			onChooseBuild={handleChooseBuild}
			onDiscard={handleDiscard}
			onPlayPowerup={handlePlayPowerup}
			// Test state handlers
			onTestState1={handleTestState1}
			onTestState2={handleTestState2}
		/>
	);
};
