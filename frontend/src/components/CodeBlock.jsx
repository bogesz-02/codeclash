import { useDrag, useDrop } from "react-dnd";
import { useRef } from "react";

export const CodeBlock = ({ block, index, onReorder, onRemove, onRemoveNested, onDropCard, onPlayPowerup, isOpponent = false, canEdit = true, parentBlock = null, parentIndex = null, maxBlocks = 5, totalBlockCount = 0 }) => {
	const ref = useRef(null);
	const childDropRef = useRef(null);

	if (!block || !block.card) {
		return null;
	}

	const isBugged = !!block.bugged;
	const effectiveCanEdit = canEdit && !isBugged;
	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: "CODE_BLOCK",
			item: {
				index,
				block,
				parentIndex,
				blockId: block.id, // Add block ID for stable tracking
			},
			canDrag: effectiveCanEdit,
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[index, block, effectiveCanEdit, parentIndex]
	);

	const [{ isOver }, drop] = useDrop(
		() => ({
			accept: ["CODE_BLOCK", "CARD"],
			canDrop: (item) => {
				if (isOpponent) {
					const isBugPowerup = item.card?.type === "powerup" && item.card?.key === "bug";
					console.log("[CodeBlock canDrop opponent]", { isBugPowerup, alreadyBugged: isBugged, blockId: block.id });
					return isBugPowerup && !isBugged;
				}
				// Own blocks: accept non-powerup cards (placement/reorder) or targeted powerups
				if (item.card?.type === "powerup") {
					// Only capacity_increase and debug powerups can target own blocks
					if (item.card.key === "capacity_increase") {
						return ["for_loop", "if"].includes(block.card?.key) && !isBugged;
					}
					if (item.card.key === "debug") {
						return isBugged;
					}
					return false; // other powerups cannot target own blocks
				}
				return true; // normal cards/blocks can be dropped/reordered if canEdit
			},
			hover: (item, monitor) => {
				// Skip reorder for powerups entirely
				if (item.card?.type === "powerup") return;
				if (!ref.current || !effectiveCanEdit) return;
				// Don't reorder if the item is from a nested position
				if (item.parentIndex !== null && item.parentIndex !== undefined) return;
				// Don't reorder if hovering over a nested drop zone
				if (!monitor.isOver({ shallow: true })) return;
				// Don't reorder if this block itself is nested
				if (parentIndex !== null) return;
				const dragIndex = item.index;
				const hoverIndex = index;
				if (dragIndex === hoverIndex) return;
				onReorder(dragIndex, hoverIndex);
				item.index = hoverIndex;
			},
			drop: (item, monitor) => {
				console.log("[CodeBlock drop]", { itemType: item.card?.type, key: item.card?.key, targetBlockId: block.id, isOpponent });
				if (item.card?.type === "powerup") {
					const key = item.card.key;
					const handIndex = typeof item.index === "number" ? item.index : null;
					if (key === "capacity_increase") {
						if (!isOpponent && ["for_loop", "if"].includes(block.card?.key) && !isBugged) {
							console.log("[CodeBlock] Applying capacity_increase", block.id);
							if (onPlayPowerup) onPlayPowerup(item.card, handIndex, block.id);
							return;
						}
					}
					if (key === "bug") {
						if (isOpponent && !isBugged) {
							console.log("[CodeBlock] Applying bug to opponent block", block.id);
							if (onPlayPowerup) onPlayPowerup(item.card, handIndex, block.id);
							return;
						}
					}
					if (key === "debug") {
						if (!isOpponent && isBugged) {
							console.log("[CodeBlock] Applying debug", block.id);
							if (onPlayPowerup) onPlayPowerup(item.card, handIndex, block.id);
							return;
						}
					}
					console.log("[CodeBlock] Powerup not applicable");
					return; // powerup not applicable, ignore
				}
			},
			collect: (monitor) => ({ isOver: monitor.isOver() && monitor.canDrop() }),
		}),
		[index, onReorder, effectiveCanEdit, parentIndex, block, isOpponent, isBugged, onPlayPowerup]
	);

	// Always attach drop zone to accept powerups on opponent blocks, even if not editable
	if (effectiveCanEdit || isOpponent) {
		drop(ref);
		if (effectiveCanEdit) drag(ref);
	}

	// Check if this card is a container (for_loop or if)
	const isContainer = block.card?.key === "for_loop" || block.card?.key === "if";

	// Drop zone for children (only for container blocks: for_loop and if)
	const [{ isOverChild }, dropChild] = useDrop(
		() => ({
			accept: ["CARD", "CODE_BLOCK"], // Accept both cards from hand and already placed blocks
			canDrop: (item) => {
				console.log("[CodeBlock canDrop]", {
					isContainer,
					canEdit,
					itemType: item.fromHand ? "CARD" : "CODE_BLOCK",
					parentKey: block.card?.key,
					childKey: item.card?.key || item.block?.card?.key,
					capacity: block.capacity || block.card?.baseCapacity || block.card?.base_capacity || 1,
					currentChildren: block.children?.length,
				});

				// Only allow if this is a container block
				if (!isContainer) {
					console.log("[CodeBlock] Not a container");
					return false;
				}
				if (!effectiveCanEdit) {
					console.log("[CodeBlock] Cannot edit");
					return false;
				}

				// Get the card being dragged
				const draggedCard = item.fromHand ? item.card : item.block?.card;
				if (!draggedCard) return false;

				// Reject powerup cards
				if (draggedCard.type === "powerup") {
					console.log("[CodeBlock] Powerup cards cannot be placed");
					return false;
				}

				// Global total block limit (count nested); only applies when adding new card from hand
				if (item.type === "CARD" && item.fromHand && totalBlockCount >= maxBlocks) {
					console.log("[CodeBlock] Global max total blocks reached");
					return false;
				}

				// Check capacity
				const capacity = block.capacity || block.card?.baseCapacity || block.card?.base_capacity || 1;
				const currentChildren = block.children?.length || 0;
				if (currentChildren >= capacity) {
					console.log("[CodeBlock] Capacity full");
					return false;
				}

				// For loops cannot contain other for loops
				if (block.card?.key === "for_loop" && draggedCard.key === "for_loop") {
					console.log("[CodeBlock] For loop cannot contain for loop");
					return false;
				}

				// For loops can only contain if blocks if capacity is 2
				if (block.card?.key === "for_loop" && draggedCard.key === "if" && capacity < 2) {
					console.log("[CodeBlock] For loop capacity must be 2 to contain if");
					return false;
				}

				// If blocks cannot contain for loops
				if (block.card?.key === "if" && draggedCard.key === "for_loop") {
					console.log("[CodeBlock] If cannot contain for loop");
					return false;
				}

				// If blocks cannot contain other if blocks
				if (block.card?.key === "if" && draggedCard.key === "if") {
					console.log("[CodeBlock] If cannot contain another if");
					return false;
				}

				console.log("[CodeBlock] Can drop!");
				return true;
			},
			drop: (item, monitor) => {
				console.log("[CodeBlock drop]", {
					item,
					didDrop: monitor.didDrop(),
					thisBlockIndex: index,
					thisParentIndex: parentIndex,
					isNested: parentIndex !== null && parentIndex !== undefined,
				});

				// Don't handle if dropping on a nested child
				if (monitor.didDrop()) {
					console.log("[CodeBlock] Already handled by nested drop");
					return;
				}

				// Only top-level blocks should handle drops into their children
				// Nested blocks shouldn't process drops (no nested-nested support yet)
				if (parentIndex !== null && parentIndex !== undefined) {
					console.log("[CodeBlock] This is a nested block, not handling drop");
					return;
				}

				if (onDropCard) {
					console.log("[CodeBlock] Top-level container handling drop");
					console.log("[CodeBlock] This block:", block.card?.name, "at index:", index);
					console.log("[CodeBlock] Dragged item:", item.block?.card?.name || item.card?.name, "from index:", item.index);
					console.log("[CodeBlock] Calling onDropCard with parentIndex:", index);
					onDropCard(item, index); // index is this block's position in top-level array
				}
			},
			collect: (monitor) => ({
				isOverChild: monitor.isOver({ shallow: true }) && monitor.canDrop(),
			}),
		}),
		[block, index, onDropCard, canEdit, isContainer]
	);

	if (isContainer && effectiveCanEdit) {
		dropChild(childDropRef);
	}

	const getBlockColor = (card) => {
		const cardKey = card?.key || card?.card_key;
		let baseColor = "";

		switch (cardKey) {
			case "for_loop":
				baseColor = "bg-indigo-500/50 border-indigo-950 text-indigo-950";
				break;
			case "if":
				baseColor = "bg-lime-500/50 border-lime-950 text-lime-950";
				break;
			case "attack":
				baseColor = "bg-purple-500/50 border-purple-950 text-purple-950";
				break;
			case "healing":
				baseColor = "bg-red-500/50 border-red-950 text-red-950";
				break;
			case "draw_card":
				baseColor = "bg-pink-500/50 border-pink-950 text-pink-950";
				break;
			case "energy":
				baseColor = "bg-amber-500/50 border-amber-950 text-amber-950";
				break;
			case "dodge":
				baseColor = "bg-pink-500/50 border-pink-950 text-pink-950";
				break;
			case "hide":
				baseColor = "bg-pink-500/50 border-pink-950 text-pink-950";
				break;
			default:
				baseColor = "bg-gray-500/50 border-gray-700 text-gray-900";
		}

		// Add grey overlay for bugged blocks
		if (isBugged) {
			return `${baseColor} relative before:absolute before:inset-0 before:bg-black/60 before:rounded-lg`;
		}

		return baseColor;
	};

	return (
		<div ref={ref} className={`relative ${getBlockColor(block.card)} border-2 rounded-lg p-3 ${isDragging ? "opacity-50" : "opacity-100"} ${effectiveCanEdit ? "cursor-move" : ""} transition-all ${isOver ? "ring-2 ring-white" : ""}`}>
			{/* Bugged overlay shade */}
			{isBugged && <div className="absolute inset-0 bg-black/40 rounded-lg pointer-events-none" />}
			<div className="relative flex items-center justify-between mb-2">
				<span className="text-sm font-bold text-white">{block.card?.name || "Ismeretlen kártya"}</span>
				<div className="flex items-center gap-2">
					{isBugged && <span className="text-xs text-red-300 font-bold">🐛 HIBA</span>}
					{effectiveCanEdit && typeof onRemove === "function" && !isBugged && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onRemove(index);
							}}
							title="Blokk eltávolítása"
							className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded px-2 py-0.5 text-xs border border-white/20"
						>
							Eltávolítás
						</button>
					)}
				</div>
			</div>

			{/* Show displayText for container blocks (for_loop, if), show description for action/effect blocks */}
			<div className="relative">
				{isContainer && block.card?.displayText && <div className="text-xs text-white/80 mb-1">{block.card.displayText}</div>}
				{!isContainer && block.card?.description && <div className="text-[10px] text-white/60 italic mt-1">{block.card.description}</div>}
			</div>

			{/* Nested drop zone for container blocks (only for_loop and if) */}
			{isContainer && (
				<div className="relative mt-3">
					<div className="flex items-center justify-between mb-1">
						<div className="text-[10px] text-white/50 uppercase tracking-wider">Tartalmaz</div>
						<div className="text-[10px] px-1 py-[2px] rounded bg-white/10 border border-white/20 text-white/70">
							{block.children?.length || 0}/{block.capacity || block.card?.baseCapacity || block.card?.base_capacity || 1}
						</div>
					</div>
					<div
						ref={childDropRef}
						className={`
								border-2 rounded-md p-2 min-h-[4rem] 
								transition-all duration-200
								${isOverChild ? "border-white bg-white/20 shadow-lg" : "border-white/30 border-dashed bg-black/20"}
							`}
					>
						{block.children && block.children.length > 0 ? (
							<div className="space-y-2">
								{block.children.map((child, i) => (
									<CodeBlock
										key={i}
										block={child}
										index={i}
										onReorder={() => {}} // No reordering within nested blocks for now
										onRemove={(childIndex) => {
											if (onRemoveNested) {
												onRemoveNested(index, childIndex);
											}
										}}
										onRemoveNested={onRemoveNested}
										onDropCard={onDropCard}
										onPlayPowerup={onPlayPowerup}
										isOpponent={isOpponent}
										canEdit={canEdit}
										parentBlock={block}
										parentIndex={index}
										maxBlocks={maxBlocks}
										totalBlockCount={totalBlockCount}
									/>
								))}
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-xs text-white/40 italic">
								Húzd ide a kártyát ({block.children?.length || 0}/{block.capacity || block.card?.baseCapacity || block.card?.base_capacity || 1})
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default CodeBlock;
