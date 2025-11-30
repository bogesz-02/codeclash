import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { SERVER_CONFIG } from "./config/server.config.js";
import { setupSocketHandlers } from "./sockets/socket.handler.js";
import { cardsService } from "./services/cards.service.js";
import "./db/mysql.js"; // Initialize database connection

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: SERVER_CONFIG.corsOrigin,
		methods: ["GET", "POST"],
	},
});

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
	res.json({ status: "ok" });
});

app.get("/health/db", async (req, res) => {
	try {
		const { query } = await import("./db/mysql.js");
		await query("SELECT 1");
		res.json({ status: "ok", database: "connected" });
	} catch (error) {
		res.status(500).json({ status: "error", database: "disconnected", error: error.message });
	}
});

// Cards API endpoints
app.get("/api/cards", async (req, res) => {
	try {
		const cards = await cardsService.getAllCards();
		res.json({ success: true, cards });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
});

app.get("/api/cards/:id", async (req, res) => {
	try {
		const card = await cardsService.getCardById(parseInt(req.params.id));
		if (card) {
			res.json({ success: true, card: cardsService.parseCardConfig(card) });
		} else {
			res.status(404).json({ success: false, error: "Card not found" });
		}
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
});

setupSocketHandlers(io);

httpServer.listen(SERVER_CONFIG.port, () => {
	console.log(`Server running on port ${SERVER_CONFIG.port}`);
});

process.on("uncaughtException", (err) => {
	console.error("[uncaughtException]", err?.stack || err);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("[unhandledRejection]", reason);
});
