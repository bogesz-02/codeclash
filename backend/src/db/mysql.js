import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
	host: process.env.DB_HOST || "localhost",
	port: parseInt(process.env.DB_PORT || "3306"),
	database: process.env.DB_NAME || "game_db",
	user: process.env.DB_USER || "game_user",
	password: process.env.DB_PASS || "",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const maxAttempts = parseInt(process.env.DB_CONNECT_RETRIES || "20", 10);
const retryDelayMs = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || "2000", 10);

(async function tryConnectWithRetry() {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const connection = await pool.getConnection();
			console.log("✅ MySQL connected successfully");
			connection.release();
			return;
		} catch (err) {
			if (typeof AggregateError !== "undefined" && err instanceof AggregateError) {
				const inner = err.errors || [];
				const msgs = inner.map((e) => e?.message || String(e));
				console.error(`❌ MySQL connection attempt ${attempt} failed (AggregateError):`, msgs.join("; "));
			} else if (Array.isArray(err?.errors)) {
				const msgs = err.errors.map((e) => e?.message || String(e));
				console.error(`❌ MySQL connection attempt ${attempt} failed (errors[]):`, msgs.join("; "));
			} else {
				const msg = err?.message || String(err);
				console.error(`❌ MySQL connection attempt ${attempt} failed: ${msg}`);
				if (err?.stack) console.error(err.stack);
			}

			if (attempt < maxAttempts) {
				await wait(retryDelayMs);
			} else {
				console.error("❌ MySQL connection failed after all retries:", err);
			}
		}
	}
})();

export async function query(sql, params = []) {
	try {
		const [rows] = await pool.execute(sql, params);
		return rows;
	} catch (error) {
		console.error("Database query error:", error);
		throw error;
	}
}

export default pool;
