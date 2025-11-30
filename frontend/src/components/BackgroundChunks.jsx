import React from "react";

export const BackgroundChunks = () => {
	return (
		<div className="absolute inset-0 -z-10 overflow-hidden">
			{/* Top row pixels */}
			<div className="absolute top-[5%] left-[10%] w-24 h-24 bg-indigo-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-2s" }} />
			<div className="absolute top-[8%] right-[15%] w-32 h-32 bg-purple-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-3s" }} />
			<div className="absolute top-[15%] left-[35%] w-16 h-16 bg-pink-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-1s" }} />

			{/* Middle scattered pixels */}
			<div className="absolute top-[30%] right-[30%] w-28 h-28 bg-blue-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-4s" }} />
			<div className="absolute top-[45%] left-[20%] w-20 h-20 bg-indigo-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-2.5s" }} />
			<div className="absolute top-[40%] right-[10%] w-36 h-36 bg-purple-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-1.5s" }} />

			{/* Bottom row pixels */}
			<div className="absolute bottom-[20%] left-[15%] w-32 h-32 bg-pink-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-3.5s" }} />
			<div className="absolute bottom-[10%] right-[25%] w-24 h-24 bg-blue-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-2.8s" }} />
			<div className="absolute bottom-[25%] left-[40%] w-28 h-28 bg-indigo-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-1.8s" }} />

			{/* Corner pixels */}
			<div className="absolute top-[12%] left-[85%] w-16 h-16 bg-purple-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-4.2s" }} />
			<div className="absolute bottom-[15%] right-[5%] w-20 h-20 bg-pink-600/20 animate-glitch animate-flicker" style={{ animationDelay: "-3.2s" }} />
		</div>
	);
};

export default BackgroundChunks;
