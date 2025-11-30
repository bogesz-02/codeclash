import React from "react";
import { getGradientFromId } from "../utils/avatarGradient";

export const PlayerArea = ({ player = {}, isMe = false, index }) => {
	const maxHp = 10;
	const maxEnergy = 3;
	const hp = typeof player.hp === "number" ? player.hp : maxHp;
	const energy = typeof player.energy === "number" ? player.energy : maxEnergy;
	const attack = typeof player.attack === "number" ? player.attack : 1;

	const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
	const gradient = getGradientFromId(player.id || "", index);
	const displayName = isMe ? "Te" : player.id ? player.id.substring(0, 8) : "Player";

	return (
		<div className="w-full bg-white/6 backdrop-blur-sm border border-white/10 rounded-xl p-2 shadow-lg">
			<div className="flex items-center gap-1.5">
				<div className="w-10 h-10 rounded-full flex items-center justify-center text-base text-white flex-shrink-0" style={{ background: gradient }} title={player.id}>
					👤
				</div>

				<div className="flex-1">
					<div className="text-lg font-semibold text-white !px-0 !py-0">{displayName}</div>

					<div className="!mt-0 !pt-0">
						<div className="flex items-center justify-between text-sm text-indigo-100/70 !p-0">
							<span className="!p-0">Attack</span>
							<span className="font-medium">{attack}</span>
						</div>
					</div>

					<div className="!mt-0 !pt-0">
						<div className="flex items-center justify-between text-sm text-indigo-100/70 !p-0">
							<span className="!p-0">Életerő</span>
							<span className="font-medium">
								{hp} / {maxHp}
							</span>
						</div>

						<div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden !p-0 !m-0">
							<div className="h-2 rounded-full !p-0 !m-0" style={{ width: `${hpPercent}%`, background: "linear-gradient(90deg,#ef4444,#f97316)" }} />
						</div>
					</div>

					<div className="!mt-0 !pt-0">
						<div className="flex items-center gap-2 text-sm text-indigo-100/70 !p-0 !mb-1">Energia</div>
						<div className="flex items-center gap-0.5 !p-0 !m-0">
							{Array.from({ length: maxEnergy }).map((_, i) => {
								const filled = i < energy;
								return (
									<div key={i} className={`w-5 h-5 rounded flex items-center justify-center text-sm font-semibold ${filled ? "bg-yellow-400 text-gray-900" : "bg-gray-800 text-gray-400"}`}>
										{filled ? "⚡" : "—"}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PlayerArea;
