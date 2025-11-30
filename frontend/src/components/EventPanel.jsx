import React from "react";

export const EventPanel = ({ events = [], currentPlayerId = null }) => {
	// Localize event messages based on current player
	const localizeMessage = (message, details, actorId, targetId) => {
		if (!currentPlayerId) return { message, details };

		const actorName = actorId === currentPlayerId ? "Te" : "Ellenfél";
		const targetName = targetId === currentPlayerId ? "Te" : "Ellenfél";

		const localizedMessage = message.replace("{playerId}", actorName).replace("{targetId}", targetName).replace("{opponentId}", targetName);
		const localizedDetails = details ? details.replace("{playerId}", actorName).replace("{targetId}", targetName).replace("{opponentId}", targetName) : details;

		return { message: localizedMessage, details: localizedDetails };
	};

	// Group events by round
	const groupedEvents = events.reduce((acc, event) => {
		const roundNum = event.round ?? 0;
		if (!acc[roundNum]) {
			acc[roundNum] = [];
		}
		acc[roundNum].push(event);
		return acc;
	}, {});

	const rounds = Object.keys(groupedEvents).sort((a, b) => Number(a) - Number(b));

	return (
		<div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col h-[65vh]">
			<div className="text-center mb-3 flex-shrink-0">
				<h3 className="text-lg font-bold text-white">Eseménynapló</h3>
				<div className="text-xs text-white/60">Játék események</div>
			</div>

			<div className="flex-1 overflow-y-auto min-h-0 space-y-2 text-sm scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-white/5">
				{events.length === 0 ? (
					<div className="text-center text-white/50 text-sm mt-4">Még nincs esemény...</div>
				) : (
					rounds.map((roundNum) => (
						<div key={roundNum} className="border border-white/20 rounded-lg p-2 bg-white/5">
							<div className="text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">Kör {roundNum}</div>
							<div className="space-y-1">
								{groupedEvents[roundNum].map((event, index) => {
									const { message } = localizeMessage(event.message, event.details, event.actorId, event.targetId);
									return (
										<div key={index} className="text-white/80 leading-relaxed">
											<span className="text-white/90">{message}</span>
										</div>
									);
								})}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default EventPanel;
