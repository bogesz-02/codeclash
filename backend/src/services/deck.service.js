import { cardsService } from "./cards.service.js";
import { randomUUID } from "crypto";

class DeckService {
	// Build shuffled deck from deck_composition table
	async buildDeck() {
		const composition = await cardsService.getDeckComposition();

		if (!composition || composition.length === 0) {
			throw new Error("No deck composition found in database");
		}

		const deck = [];

		for (const entry of composition) {
			const quantity = entry.quantity || 0;

			for (let i = 0; i < quantity; i++) {
				deck.push({ ...this._mapCompositionToCard(entry), instanceId: randomUUID() });
			}
		}

		if (deck.length === 0) {
			throw new Error("Generated deck is empty - check deck_composition table");
		}

		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}

		return deck;
	}

	_mapCompositionToCard(composition) {
		let params = {};
		if (composition.params) {
			if (typeof composition.params === "string") {
				try {
					params = JSON.parse(composition.params);
				} catch (e) {
					console.warn(`[deck.service] Failed to parse params for ${composition.card_key}:`, composition.params);
					params = {};
				}
			} else if (typeof composition.params === "object") {
				params = composition.params;
			}
		}

		return {
			cardId: composition.card_id,
			key: composition.card_key,
			name: composition.card_name,
			type: composition.type,
			rarity: composition.rarity,
			description: composition.description,
			baseCapacity: composition.base_capacity,
			maxCapacity: composition.max_capacity,
			variationId: composition.variation_id || null,
			variationKey: composition.variation_key || null,
			displayText: composition.display_text || composition.card_name,
			params: params,
			codeTemplate: composition.code_template,
		};
	}
}

export const deckService = new DeckService();
