export const ActionPanel = ({ round, turnPhase, hand, hasDrawn, playerReady, hasEmptyContainers, onDrawCard, onChooseBuild, onReady }) => {
	return (
		<div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-lg">
			<div>
				{/* Round info (smaller bottom gap) */}
				<div className="text-center mb-1 !p-0">
					<div className="text-xs text-white/60 !pt-1 !pb-0">Kör</div>
					<div className="text-xl font-bold text-white !pt-1 !pb-0">{round}</div>
				</div>

				{/* Status */}
				<div className="text-center mb-2 !p-0">
					<div className="text-xs text-white/60 !pt-2 !pb-0">Állapot</div>
					<div className="text-base font-semibold text-white capitalize !pt-1 !pb-0">{turnPhase === "choose" ? "Tervezés" : turnPhase === "building" ? "Építés" : turnPhase === "drawn" ? "Húzás" : "Végrehajtás"}</div>
				</div>

				{/* Actions */}
				<div>
					{turnPhase === "choose" && (
						<div className="flex flex-col gap-1.5">
							<button
								onClick={() => {
									console.log("[ActionPanel] Draw Card button clicked");
									onDrawCard && onDrawCard();
								}}
								disabled={hand.length >= 5 || hasDrawn}
								className={`w-full px-4 py-2 text-sm font-bold rounded-lg transition ${hand.length >= 5 || hasDrawn ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white`}
							>
								🎴 Kártya húzása
							</button>
							<button onClick={onChooseBuild} className="w-full px-4 py-2 text-sm font-bold rounded-lg transition bg-purple-600 hover:bg-purple-700 text-white">
								🔧 Kód építése
							</button>
						</div>
					)}

					{turnPhase === "drawn" && (
						<>
							<div className="text-xs text-white/70 text-center mb-2">Húztál egy kártyát. Az építés letiltva.</div>
							<button onClick={onReady} disabled={playerReady} className={`w-full px-4 py-2 text-sm font-bold rounded-lg transition ${playerReady ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"} text-white`}>
								{playerReady ? "✓ Kész" : "Kör vége"}
							</button>
						</>
					)}

					{turnPhase === "building" && (
						<div className="flex flex-col gap-1">
							<button onClick={onReady} disabled={playerReady || hasEmptyContainers} className={`w-full px-4 py-2 text-sm font-bold rounded-lg transition ${playerReady || hasEmptyContainers ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"} text-white`} title={hasEmptyContainers ? "Nem jelölheted késznek: üres ciklus vagy feltétel blokk van." : playerReady ? "Már kész vagy" : "Jelöld késznek a kódot"}>
								{playerReady ? "✓ Kész" : hasEmptyContainers ? "Javítsd az üres blokkokat" : "Kész"}
							</button>
							{hasEmptyContainers && !playerReady && <div className="text-[11px] text-yellow-300 text-center font-medium">Üres for/if blokk nem engedélyezett.</div>}
						</div>
					)}

					{turnPhase === "execution" && <div className="text-white/80 text-sm font-semibold text-center">⚡ Végrehajtás...</div>}
				</div>
			</div>
		</div>
	);
};

export default ActionPanel;
