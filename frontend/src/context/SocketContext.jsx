import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

// Socket.IO connection context (provides socket instance and connection state)
const SocketContext = createContext(null);

export const useSocket = () => {
	const context = useContext(SocketContext);
	if (!context) {
		throw new Error("useSocket must be used within SocketProvider");
	}
	return context;
};

export const SocketProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [connected, setConnected] = useState(false);

	useEffect(() => {
		const newSocket = io("http://localhost:3001");

		newSocket.on("connect", () => {
			setConnected(true);
			console.log("Connected to server");
		});

		newSocket.on("disconnect", () => {
			setConnected(false);
			console.log("Disconnected from server");
		});

		newSocket.on("connect_error", (err) => {
			console.error("Socket connect_error:", err?.message || err);
		});

		newSocket.on("error", (err) => {
			console.error("Socket error:", err);
		});

		setSocket(newSocket);

		return () => {
			newSocket.close();
		};
	}, []);

	return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
};
