import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import PlayerArea from "./PlayerArea";
import BackgroundChunks from "./BackgroundChunks";
import { Hand } from "./Hand";
import { CodePanel } from "./CodePanel";
import { EventPanel } from "./EventPanel";
import { ActionPanel } from "./ActionPanel";

// confirmOpen: boolean to show leave confirmation
// onOpenConfirm: function to open the confirmation modal
// onConfirmLeave: function called when user confirms leaving
// onCancelLeave: function when user cancels
// gameOver: boolean to show game over modal
// gameResult: { winner, loser } game over result
// myId: current player's socket id
export const GameField = ({ player = {}, opponent = {}, onLeave, opponentLeft = false, gameOver = false, gameResult = null, myId = null, confirmOpen = false, onOpenConfirm, onConfirmLeave, onCancelLeave, hand = [], codeBlocks = [], opponentCodeBlocks = [], playerReady = false, opponentReady = false, turnPhase = "choose", hasDrawn = false, round = 1, onDropCard, onReorder, onRemoveBlock, onRemoveNested, onReady, onDrawCard, onChooseBuild, onDiscard, onPlayPowerup, events = [], onTestState1, onTestState2 }) => {
	// Detect empty container blocks (for_loop / if) recursively
	const hasEmptyContainers = (() => {
		const isContainer = (b) => b && b.card && ["for_loop", "if"].includes(b.card.key || b.card.card_key);
		const visit = (b) => {
			if (!b) return false;
			if (isContainer(b) && (!Array.isArray(b.children) || b.children.length === 0)) return true;
			return Array.isArray(b.children) && b.children.some((c) => visit(c));
		};
		return Array.isArray(codeBlocks) && codeBlocks.some((b) => visit(b));
	})();
	return (
		<DndProvider backend={HTML5Backend}>
			<div className="min-h-screen text-white flex items-center justify-center px-4 md:px-6 py-4 md:py-6 relative overflow-hidden">
				{/* Background gradient (separate so BackgroundChunks can sit above it) */}
				<div
					className="absolute inset-0 -z-20"
					style={{
						background: "radial-gradient(circle at center, #282964 0%, #252257 35%, #161533 100%)",
					}}
				/>
				{/* Animated background chunks (same as Home) */}
				<BackgroundChunks />

				{/* Main layout grid: player info + code | event log | opponent code + info */}
				<div className="w-full max-w-none grid grid-cols-12 gap-2 items-start">
					{/* Left section: player panel with function panel below, and code panel */}
					<div className="col-span-12 md:col-span-5">
						<div className="grid grid-cols-12 gap-4 items-stretch">
							{/* Player panel and function panel stacked */}
							<div className="col-span-12 md:col-span-5 flex flex-col gap-2">
								{/* Player panel */}
								<PlayerArea player={player} isMe index={0} />

								{/* Action panel */}
								<ActionPanel round={round} turnPhase={turnPhase} hand={hand} hasDrawn={hasDrawn} playerReady={playerReady} hasEmptyContainers={hasEmptyContainers} onDrawCard={onDrawCard} onChooseBuild={onChooseBuild} onReady={onReady} />
							</div>{" "}
							{/* Player code panel */}
							<div className="col-span-12 md:col-span-7 h-full">
								<CodePanel codeBlocks={codeBlocks} onDropCard={onDropCard} onReorder={onReorder} onRemoveBlock={onRemoveBlock} onRemoveNested={onRemoveNested} onPlayPowerup={onPlayPowerup} maxBlocks={5} canEdit={turnPhase === "building"} />
							</div>
						</div>
					</div>
					{/* Middle section: Event log */}
					<div className="col-span-12 md:col-span-2 h-full">
						<EventPanel events={events} currentPlayerId={player?.id} />
					</div>{" "}
					{/* Right section: opponent code panel and opponent player panel */}
					<div className="col-span-12 md:col-span-5">
						<div className="grid grid-cols-12 gap-4 items-start">
							{/* Opponent code panel widened */}
							<div className="col-span-12 md:col-span-7">
								<CodePanel codeBlocks={opponentCodeBlocks} isOpponent={true} opponentReady={opponentReady} maxBlocks={5} onPlayPowerup={onPlayPowerup} />
							</div>

							{/* Opponent info (right side, narrower) */}
							<div className="col-span-12 md:col-span-5">{opponent ? <PlayerArea player={opponent} index={1} /> : <div />}</div>
						</div>
					</div>
					{/* Hand + Leave wrapped together (preserve hand position using inner 12-col grid) */}
					<div className="col-span-12 !m-0 !pt-0">
						<div className="grid grid-cols-12 items-end">
							{/* Left placeholder to keep hand starting at col 3 on md */}
							<div className="hidden md:block md:col-span-2" />
							{/* Hand occupies 8 columns on md (cols 3-10) */}
							<div className="col-span-12 md:col-span-8 flex items-end">
								<Hand cards={hand} maxCards={5} canDrag={turnPhase === "building"} canDiscard={turnPhase !== "execution"} onDiscard={onDiscard} onPlayPowerup={onPlayPowerup} />
							</div>
							{/* Button occupies last 2 columns (11-12) aligned with bottom of hand */}
							<div className="col-span-12 md:col-span-2 flex items-end justify-end mt-3 md:mt-0">
								<button onClick={onOpenConfirm} title="Kilépés a játékból" className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium shadow">
									Kilépés
								</button>
							</div>
						</div>
					</div>
					{/* Test State Buttons - Bottom of screen */}
					{onTestState1 && onTestState2 && (
						<div className="col-span-12 flex justify-center gap-4 mt-2">
							<button onClick={onTestState1} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow text-sm" title="Test 1: Both max HP/Energy. P1: count_3, attack, energy. P2: dodge, draw_from_opponent, count_2">
								Test State 1
							</button>
							<button onClick={onTestState2} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium shadow text-sm" title="Test 2: P1 2HP/max energy with heal, cond_health_below_3, debug. P2 max HP/energy with count_3, attack, bug">
								Test State 2
							</button>
						</div>
					)}
				</div>

				{/* Opponent left warning banner */}
				{opponentLeft && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
						<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
							<div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-lg p-6 w-full max-w-sm text-center">A másik játékos elhagyta a játékot. Visszatérés a lobbyba...</div>
						</div>
					</div>
				)}

				{/* Confirmation modal */}
				{confirmOpen && !opponentLeft && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
						<div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-lg p-6 w-full max-w-sm text-center">
							<h3 className="text-lg font-semibold mb-4">Biztosan kilépsz?</h3>
							<p className="text-sm text-indigo-100/70 mb-6">Ha kilépsz, a másik játékos automatikusan visszakerül a lobbyba.</p>
							<div className="flex justify-center gap-4">
								<button
									onClick={() => {
										onCancelLeave && onCancelLeave();
									}}
									className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
								>
									Mégsem
								</button>
								<button
									onClick={() => {
										onConfirmLeave && onConfirmLeave(true);
									}}
									className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white"
								>
									Kilépés
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Game Over Modal */}
				{gameOver && gameResult && (
					<div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
						<div className="bg-slate-800 border-4 border-purple-500 rounded-lg p-8 text-center">
							<h2 className="text-4xl font-bold mb-4">{myId === gameResult.winner?.id ? <span className="text-green-400">🎉 Nyertél! 🎉</span> : <span className="text-red-400">💀 Vesztettél! 💀</span>}</h2>
							<p className="text-xl text-gray-300 mb-2">{myId === gameResult.winner?.id ? `${gameResult.loser?.username || "Ellenfél"} legyőzve!` : `${gameResult.winner?.username || "Ellenfél"} győzött!`}</p>
							<p className="text-gray-400 mt-4">Visszatérés a lobbyba 5 másodperc múlva...</p>
						</div>
					</div>
				)}
			</div>
		</DndProvider>
	);
};

export default GameField;
