import { Card } from "./Card";

export const Hand = ({ cards = [], maxCards = 5, canDrag = true, canDiscard = false, onDiscard, onPlayPowerup }) => {
	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-lg font-bold text-white">A te kártyáid</h3>
				<span className="text-sm text-white/60">
					{cards.length}/{maxCards}
				</span>
			</div>

			<div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-3 shadow-lg min-h-[160px]">
				{cards.length === 0 ? (
					<div className="flex items-center justify-center h-full text-white/40 text-sm">Nincs kártya a kezedben</div>
				) : (
					<div className="flex gap-1.5 flex-wrap justify-center">
						{cards.map((card, index) => (
							<div key={`hand-${card.instanceId || index}-${card.cardId || card.key}`} className="relative">
								<Card card={card} index={index} fromHand={true} canDrag={canDrag || card.type === "powerup"} onPlayPowerup={(c) => onPlayPowerup && onPlayPowerup(c, index)} />
								{canDiscard && (
									<button onClick={() => onDiscard && onDiscard(card.instanceId)} title="Kártya eldobása" className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow">
										×
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Hand;
