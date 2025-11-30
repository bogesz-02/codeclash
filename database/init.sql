-- ============================================================================
-- Card Game Database - Complete Schema with All Cards
-- ============================================================================
-- This runs automatically when the MySQL container starts with an empty data directory
-- Creates database, tables, and seeds all card data

CREATE DATABASE IF NOT EXISTS game_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE game_db;

-- ============================================================================
-- Table: cards
-- Stores master card definitions (types, templates, properties)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Programmatic identifier (e.g. for_loop, attack)',
  name VARCHAR(100) NOT NULL COMMENT 'Display name in Hungarian',
  type ENUM('placeable','powerup') NOT NULL COMMENT 'Placeable cards go in code area, powerups are instant',
  category ENUM('control','action','effect','utility') NULL COMMENT 'Grouping for UI/filtering',
  description TEXT COMMENT 'What the card does',
  base_capacity TINYINT NULL COMMENT 'How many cards can fit inside (for control cards)',
  max_capacity TINYINT NULL COMMENT 'Max capacity after upgrades',
  is_placeable TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Can be placed in code area',
  can_upgrade TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Can be upgraded with capacity_increase powerup',
  energy_cost TINYINT NOT NULL DEFAULT 0 COMMENT 'Energy required to use this card',
  code_template TEXT NOT NULL COMMENT 'Template with {placeholders} for code generation',
  rarity ENUM('common','uncommon','rare','epic') DEFAULT 'common' COMMENT 'Affects deck distribution',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: card_variations
-- Stores parameterized versions of cards (e.g. for_loop with count=2,3,4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS card_variations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL COMMENT 'Reference to parent card',
  variation_key VARCHAR(50) NOT NULL COMMENT 'Unique identifier for this variation',
  display_text VARCHAR(100) NOT NULL COMMENT 'Text shown to player',
  params JSON NOT NULL COMMENT 'Parameters for code generation (e.g. {"count":3})',
  rarity_weight INT NOT NULL DEFAULT 1 COMMENT 'Higher weight = more common in deck',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_card_variation (card_id, variation_key),
  CONSTRAINT fk_variation_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: deck_composition
-- Defines how many of each card/variation should be in a standard deck
-- ============================================================================
CREATE TABLE IF NOT EXISTS deck_composition (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL COMMENT 'Reference to card',
  variation_id INT NULL COMMENT 'Reference to specific variation (NULL = any/all variations)',
  quantity INT NOT NULL COMMENT 'How many copies in the deck',
  CONSTRAINT fk_deck_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_deck_variation FOREIGN KEY (variation_id) REFERENCES card_variations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Seed Data: Cards (with all updates applied)
-- ============================================================================

-- Placeable Cards: Control Structures
INSERT INTO cards 
(`key`, name, type, category, description, base_capacity, max_capacity, is_placeable, can_upgrade, energy_cost, code_template, rarity)
VALUES
('for_loop', 'For ciklus', 'placeable', 'control', 'Ismétli a belső kódot többször. Lehet benne 1-2 kártya.', 1, 2, 1, 1, 0, 'for (let i = 0; i < {count}; i++) {\n  {body}\n}', 'uncommon'),
('if', 'Feltétel', 'placeable', 'control', 'Feltétel alapján futtatja a belső kódot. Lehet benne 1-2 kártya.', 1, 2, 1, 1, 0, 'if ({condition}) {\n  {body}\n}', 'common');

-- Placeable Cards: Actions (with updated templates)
INSERT INTO cards 
(`key`, name, type, category, description, base_capacity, max_capacity, is_placeable, can_upgrade, energy_cost, code_template, rarity)
VALUES
('attack', 'Támadás', 'placeable', 'action', '1 sebzés az ellenfélnek, de 1 energiába kerül.', NULL, NULL, 1, 0, 1, 'if (hasEnergy(1)) { attack(1); consumeEnergy(1); }', 'common'),
('healing', 'Gyógyítás', 'placeable', 'action', 'Visszanyersz 1 HP-t 1 energiáért.', NULL, NULL, 1, 0, 1, 'if (hasEnergy(1)) { heal(1); }', 'common');

-- Placeable Cards: Utility
INSERT INTO cards 
(`key`, name, type, category, description, base_capacity, max_capacity, is_placeable, can_upgrade, energy_cost, code_template, rarity)
VALUES
('draw_card', 'Lap húzás', 'placeable', 'utility', 'Húzol egy lapot a pakliból. Ha tele a kezed, el kell dobni egyet.', NULL, NULL, 1, 0, 0, 'if (handSize() < handMax()) { draw(1); } else { draw(1, {allowOverflow: true}); }', 'uncommon'),
('energy', 'Energia visszanyerés', 'placeable', 'utility', 'Visszanyersz 1 energiát. Ebben a körben nem támadhatsz.', NULL, NULL, 1, 0, 0, 'if (energy < 3) { gainEnergy(1); markSkipAttack(); }', 'common');

-- Placeable Cards: Effects (with updated templates)
INSERT INTO cards 
(`key`, name, type, category, description, base_capacity, max_capacity, is_placeable, can_upgrade, energy_cost, code_template, rarity)
VALUES
('dodge', 'Kitérés', 'placeable', 'effect', 'Elkerülsz 1 támadást ebben a körben, de 1 energiába kerül.', NULL, NULL, 1, 0, 1, 'if (opponent_attacked_this_round && hasEnergy(1)) { registerEffect("dodge_one", {remaining: 1}); consumeEnergy(1); }', 'uncommon'),
('hide', 'Elbújás', 'placeable', 'effect', 'Elkerülöd az összes támadást ebben a körben, de elveszted az energiád.', NULL, NULL, 1, 0, 0, 'if (opponent_attacked_this_round && hasEnergy(1)) { registerEffect("dodge_all", {remaining: 1}); consumeEnergy(energy); }', 'rare');

-- Powerup Cards
INSERT INTO cards 
(`key`, name, type, category, description, base_capacity, max_capacity, is_placeable, can_upgrade, energy_cost, code_template, rarity)
VALUES
('capacity_increase', 'Kapacitás növelés', 'powerup', 'utility', 'Húzd egy For ciklus vagy Feltétel kártyára, és növeld a kapacitását 2-re.', NULL, NULL, 0, 0, 0, 'upgradeCapacity(targetId, 2);', 'rare'),
('draw_from_opponent', 'Lap lopás', 'powerup', 'utility', 'Ellopod az ellenfél egy véletlen lapját a kezéből.', NULL, NULL, 0, 0, 0, 'stealRandomCard(1);', 'rare'),
('opponent_discard', 'Ellenfél eldob', 'powerup', 'utility', 'Az ellenfél véletlenszerűen eldob egy lapot a kezéből.', NULL, NULL, 0, 0, 0, 'forceDiscardRandom(opponent, 1);', 'uncommon'),
('bug', 'Bug', 'powerup', 'effect', 'Lefagyasztja az ellenfél egyik kártyáját, amíg nem debug-olja.', NULL, NULL, 0, 0, 0, 'markBug(targetId);', 'epic'),
('debug', 'Debug', 'powerup', 'effect', 'Eltávolítja a bugot egy lefagyasztott kártyáról.', NULL, NULL, 0, 0, 0, 'clearBug(targetId);', 'uncommon');

-- ============================================================================
-- Seed Data: Card Variations
-- ============================================================================

-- For Loop Variations (different iteration counts)
INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'count_2', '2x ismétlés', JSON_OBJECT('count', 2), 5 FROM cards WHERE `key` = 'for_loop';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'count_3', '3x ismétlés', JSON_OBJECT('count', 3), 3 FROM cards WHERE `key` = 'for_loop';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'count_4', '4x ismétlés', JSON_OBJECT('count', 4), 1 FROM cards WHERE `key` = 'for_loop';

-- If Variations (different conditions - with corrected parameter names)
INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_opponent_attacked_this_round', 'Ha az ellenfél megtámadott ebben a körben', JSON_OBJECT('condition', 'opponent_attacked_this_round'), 2 FROM cards WHERE `key` = 'if';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_success_attack_this_round', 'Ha sikeresen támadtál ebben a körben', JSON_OBJECT('condition', 'success_attack_this_round'), 2 FROM cards WHERE `key` = 'if';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_health_below_5', 'Ha az életerőd 5 alatt van', JSON_OBJECT('condition', 'health_below_5'), 3 FROM cards WHERE `key` = 'if';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_health_below_3', 'Ha az életerőd 3 alatt van', JSON_OBJECT('condition', 'health_below_3'), 2 FROM cards WHERE `key` = 'if';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_no_energy', 'Ha nincs energiád', JSON_OBJECT('condition', 'no_energy'), 2 FROM cards WHERE `key` = 'if';

INSERT INTO card_variations (card_id, variation_key, display_text, params, rarity_weight)
SELECT id, 'cond_damage_taken_gt_3', 'Ha több mint 3 sebzést kaptál', JSON_OBJECT('condition', 'damage_taken_gt_3'), 1 FROM cards WHERE `key` = 'if';

-- ============================================================================
-- Seed Data: Deck Composition
-- ============================================================================
-- Total cards in deck: ~70 cards

-- For Loop cards (total: 12 cards - 6x2, 4x3, 2x4)
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 6 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'for_loop' AND v.variation_key = 'count_2';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 4 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'for_loop' AND v.variation_key = 'count_3';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 2 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'for_loop' AND v.variation_key = 'count_4';

-- If cards (total: 16 cards distributed across conditions)
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 3 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_opponent_attacked_this_round';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 3 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_success_attack_this_round';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 4 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_health_below_5';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 2 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_health_below_3';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 2 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_no_energy';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT c.id, v.id, 2 FROM cards c 
JOIN card_variations v ON v.card_id = c.id 
WHERE c.`key` = 'if' AND v.variation_key = 'cond_damage_taken_gt_3';

-- Action cards (no variations)
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 10 FROM cards WHERE `key` = 'attack';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 8 FROM cards WHERE `key` = 'healing';

-- Utility cards
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 6 FROM cards WHERE `key` = 'draw_card';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 8 FROM cards WHERE `key` = 'energy';

-- Effect cards
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 4 FROM cards WHERE `key` = 'dodge';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 2 FROM cards WHERE `key` = 'hide';

-- Powerup cards (rare, fewer copies)
INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 2 FROM cards WHERE `key` = 'capacity_increase';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 2 FROM cards WHERE `key` = 'draw_from_opponent';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 3 FROM cards WHERE `key` = 'opponent_discard';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 2 FROM cards WHERE `key` = 'bug';

INSERT INTO deck_composition (card_id, variation_id, quantity)
SELECT id, NULL, 3 FROM cards WHERE `key` = 'debug';
