import { useMemo } from "react";
import { useDrag } from "react-dnd";

export const Card = ({ card, index, fromHand = false, canDrag = true, onPlayPowerup }) => {
	const [{ isDragging }, drag] = useDrag(
		() => ({
			type: "CARD",
			item: { card, index, fromHand, instanceId: card.instanceId },
			canDrag: canDrag,
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		}),
		[card, index, fromHand, canDrag]
	);

	const imageSrc = useMemo(() => {
		// Prefer variationKey (e.g., cond_no_energy, count_3), else fall back to base key
		const key = card?.imageKey || card?.variationKey || card?.key || card?.card_key || (card?.name ? String(card.name).toLowerCase().replace(/\s+/g, "_") : "");
		return key ? `/cards/${key}.png` : "/cards/debug.png";
	}, [card]);

	const isPowerup = card?.type === "powerup";
	const needsTarget = isPowerup && ["capacity_increase", "bug", "debug"].includes(card?.key);
	return (
		<div ref={drag} className={`${fromHand ? "bg-transparent border-2 border-white/20" : getRarityColor(card.rarity)} rounded-lg ${fromHand ? "!p-0" : "p-2"} ${canDrag ? "cursor-grab" : "cursor-not-allowed opacity-60"} ${isDragging ? "opacity-50" : "opacity-100"} transition-opacity ${fromHand ? "w-36 h-52" : "min-w-[120px] max-w-[160px]"}`} style={{ touchAction: "none" }}>
			{fromHand ? (
				<div className="w-full h-full overflow-hidden rounded-lg">
					<img
						src={imageSrc}
						alt={card?.name || "Card"}
						onError={(e) => {
							e.currentTarget.onerror = null;
							e.currentTarget.src = "/cards/debug.png";
						}}
						className="object-cover w-full h-full"
					/>
					{isPowerup && (
						<div className="absolute inset-0 flex flex-col items-center justify-end p-1 gap-1 pointer-events-none">
							<span className="text-[10px] font-bold bg-black/50 px-1 rounded text-white uppercase tracking-wide">Erősítő</span>
							{!needsTarget && (
								<button
									onClick={(e) => {
										e.stopPropagation();
										if (onPlayPowerup) onPlayPowerup(card);
									}}
									className="pointer-events-auto text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-2 py-1 rounded shadow"
								>
									Kijátszás
								</button>
							)}
							{needsTarget && <span className="text-[10px] bg-indigo-600/80 px-1 rounded pointer-events-none">Húzd a célra</span>}
						</div>
					)}
				</div>
			) : (
				<></>
			)}
		</div>
	);
};

export default Card;
