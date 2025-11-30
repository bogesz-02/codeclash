import { query } from "../db/mysql.js";

class CardsService {
	async getAllCards() {
		const sql = "SELECT * FROM cards ORDER BY id";
		return await query(sql);
	}

	// Get cards with variations for deck generation
	async getCardsWithVariations() {
		const sql = `SELECT 
			c.id AS card_id,
			c.key AS card_key,
			c.name AS card_name,
			c.type,
			c.category,
			c.description,
			c.base_capacity,
			c.max_capacity,
			c.is_placeable,
			c.can_upgrade,
			c.energy_cost,
			c.code_template,
			c.rarity,
			v.id AS variation_id,
			v.variation_key,
			v.display_text,
			v.params,
			v.rarity_weight
		FROM cards c
		LEFT JOIN card_variations v ON v.card_id = c.id
		ORDER BY c.id, v.id`;
		return await query(sql);
	}

	async getCardById(cardId) {
		const sql = "SELECT * FROM cards WHERE id = ?";
		const results = await query(sql, [cardId]);
		return results[0] || null;
	}

	async getCardByName(cardName) {
		const sql = "SELECT * FROM cards WHERE name = ?";
		const results = await query(sql, [cardName]);
		return results[0] || null;
	}

	async getCardByKey(cardKey) {
		const sql = "SELECT * FROM cards WHERE `key` = ?";
		const results = await query(sql, [cardKey]);
		return results[0] || null;
	}

	async getCardsByType(type) {
		const sql = "SELECT * FROM cards WHERE type = ?";
		return await query(sql, [type]);
	}

	parseCardConfig(card) {
		if (card && card.config) {
			// MySQL returns JSON as object if driver supports it, otherwise string
			card.config = typeof card.config === "string" ? JSON.parse(card.config) : card.config;
		}
		return card;
	}

	// Build executable code from card tree
	async buildCode(cardUsage) {
		if (!cardUsage || !cardUsage.card) {
			throw new Error(`Card not found: ${JSON.stringify(cardUsage)}`);
		}

		let card;
		if (typeof cardUsage.card === "number") {
			card = await this.getCardById(cardUsage.card);
		} else if (typeof cardUsage.card === "string") {
			card = await this.getCardByKey(cardUsage.card);
			if (!card) {
				card = await this.getCardByName(cardUsage.card);
			}
		} else {
			// cardUsage.card is neither string nor number
			throw new Error(`Invalid card type in cardUsage: ${typeof cardUsage.card}, value: ${JSON.stringify(cardUsage.card)}`);
		}

		if (!card) {
			throw new Error(`Card not found: ${JSON.stringify(cardUsage.card)} (type: ${typeof cardUsage.card})`);
		}

		this.parseCardConfig(card);

		let code = card.code_template;

		let params = cardUsage.params || {};
		if (typeof cardUsage.card === "object" && cardUsage.card !== null && cardUsage.card.params) {
			params = { ...cardUsage.card.params, ...params };
		}

		if (params && Object.keys(params).length > 0) {
			for (const [key, value] of Object.entries(params)) {
				code = code.replace(new RegExp(`\\{${key}\\}`, "g"), value);
			}
		}

		const unreplacedParams = code.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
		if (unreplacedParams) {
			const problematic = unreplacedParams.filter((p) => {
				const param = p.replace(/[{}]/g, "");
				return param !== "body" && !code.includes(`{${param}:`); // Not {body} and not part of JS object
			});

			if (problematic.length > 0) {
				const missingParams = problematic.map((p) => p.replace(/[{}]/g, "")).join(", ");
				console.error(`[buildCode] Missing parameters for card '${card.key || card.name}':`, {
					missing: missingParams,
					providedParams: params,
					cardKey: card.key,
					variationKey: cardUsage.card.variationKey || cardUsage.variationKey,
				});
				throw new Error(`Missing parameters for card '${card.key || card.name}': ${missingParams}`);
			}
		}

		// Recursively build children code
		if (cardUsage.children && cardUsage.children.length > 0) {
			// Filter out invalid children before recursion
			const validChildren = cardUsage.children.filter((c) => c && (c.card || c.key));
			if (validChildren.length > 0) {
				const childrenCode = await Promise.all(validChildren.map((child) => this.buildCode(child)));
				code = code.replace("{body}", childrenCode.join("\n"));
			} else {
				code = code.replace("{body}", "// empty");
			}
		} else {
			// No children, replace {body} with empty or comment
			code = code.replace("{body}", "// empty");
		}

		return code;
	}

	/**
	 * Get deck composition with card details
	 * Joins deck_composition with cards and card_variations
	 * @returns {Promise<Array>} Array of composition entries with full card details
	 */
	async getDeckComposition() {
		const sql = `
			SELECT 
				dc.id AS composition_id,
				dc.quantity,
				c.id AS card_id,
				c.key AS card_key,
				c.name AS card_name,
				c.type,
				c.description,
				c.rarity,
				c.base_capacity,
				c.max_capacity,
				c.code_template,
				v.id AS variation_id,
				v.variation_key,
				v.display_text,
				v.params
			FROM deck_composition dc
			JOIN cards c ON dc.card_id = c.id
			LEFT JOIN card_variations v ON dc.variation_id = v.id
			ORDER BY c.type, c.name, v.id
		`;
		return await query(sql);
	}
}

export const cardsService = new CardsService();
