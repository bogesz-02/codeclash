import { useDrop } from "react-dnd";
import { useMemo } from "react";
import { CodeBlock } from "./CodeBlock";

export const CodePanel = ({ codeBlocks = [], onDropCard, onReorder, onRemoveBlock, onRemoveNested, onPlayPowerup, isOpponent = false, opponentReady = false, maxBlocks = 5, canEdit = true }) => {
	// Count all blocks including nested children for max blocks enforcement
	const totalBlockCount = useMemo(() => {
		const countNodes = (nodes) => {
			if (!Array.isArray(nodes)) return 0;
			return nodes.reduce((acc, n) => {
				if (!n) return acc; // skip null/undefined nodes
				return acc + 1 + (Array.isArray(n.children) ? countNodes(n.children) : 0);
			}, 0);
		};
		return countNodes(codeBlocks);
	}, [codeBlocks]);
	const [{ isOver }, drop] = useDrop(
		() => ({
			accept: ["CARD", "CODE_BLOCK"],
			canDrop: (item) => {
				if (isOpponent || !canEdit) return false;
				if (item.card?.type === "powerup") return false;
				if (item.type === "CARD" && item.fromHand && totalBlockCount >= maxBlocks) return false;
				return true;
			},
			drop: (item, monitor) => {
				console.log("[CodePanel drop]", { item, didDrop: monitor.didDrop() });

				if (monitor.didDrop()) {
					console.log("[CodePanel] Already handled by nested CodeBlock");
					return;
				}

				if (!isOpponent && canEdit) {
					console.log("[CodePanel] Dropping at top level");
					onDropCard(item, null);
				}
			},
			collect: (monitor) => ({
				isOver: monitor.isOver() && monitor.canDrop(),
			}),
		}),
		[onDropCard, isOpponent, canEdit]
	);

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-lg font-bold text-white">{isOpponent ? "Ellenfél kódja" : "A te kódod"}</h3>
				<span className="text-sm text-white/60">
					{totalBlockCount}/{maxBlocks}
				</span>
			</div>

			<div ref={drop} className={`bg-white/6 backdrop-blur-sm border ${isOver && !isOpponent ? "border-pink-400" : "border-white/10"} rounded-2xl p-4 shadow-lg min-h-[55vh] transition-colors`}>
				{codeBlocks.length === 0 && <div className="flex items-center justify-center h-full text-white/40 text-sm">{isOpponent ? (opponentReady ? "Várakozás az ellenfélre..." : "Az ellenfél építi a kódot...") : "Húzd ide a kártyákat a kód építéséhez"}</div>}

				<div className="space-y-2">
					{codeBlocks.filter(Boolean).map((block, index) => (
						<CodeBlock key={(block && block.id) || `block-${index}`} block={block} index={index} onReorder={onReorder} onRemove={onRemoveBlock} onRemoveNested={onRemoveNested} onDropCard={onDropCard} onPlayPowerup={onPlayPowerup} isOpponent={isOpponent} canEdit={!isOpponent && canEdit} maxBlocks={maxBlocks} totalBlockCount={totalBlockCount} />
					))}
				</div>
			</div>
		</div>
	);
};

export default CodePanel;
