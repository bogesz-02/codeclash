# Backend Tests

This directory contains comprehensive unit tests for the game backend.

## Statistics

- **Total Test Files**: 2
- **Total Tests**: 58 (all passing)
- **Code Coverage Target**: 80%+

## Test Structure

```text
tests/
├── execution/
│   └── execution.test.js         - Comprehensive execution tests (24 tests)
└── services/
    └── game.service.test.js      - Game state management (34 tests)
```

Note: Socket handlers are best tested through end-to-end integration tests with a running server.

## Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Test Coverage

### execution.test.js (24 tests)

Comprehensive integration tests covering all card functionality and execution logic using real services:

- ✅ **Attack Cards** (3 tests): Direct damage, insufficient energy blocking, multi-target
- ✅ **Healing Cards** (5 tests): HP restoration, energy management, healing during attacks, HP cap enforcement
- ✅ **Energy Cards** (3 tests): Energy gain, attack blocking, energy limits
- ✅ **Defensive Cards** (4 tests): Dodge (single attack), Hide (all attacks), opponent attack detection
- ✅ **For Loops** (5 tests): Iteration counts (2x, 3x, 4x), energy-limited iterations and healing
- ✅ **If Statements** (2 tests): Condition evaluation (health_below_5), conditional execution
- ✅ **Event Deduplication** (2 tests): Insufficient energy events, placeholder usage

### game.service.test.js (34 tests)

Game state management and player interactions:

- ✅ **Game Lifecycle** (3 tests): Creation, initialization, deletion
- ✅ **Player Actions** (5 tests): Draw cards, discard cards, ready status, hand capacity
- ✅ **Program Management** (3 tests): Update programs, preserve between rounds, bugged flags
- ✅ **Turn Management** (2 tests): Clear turn state, increment rounds
- ✅ **Game Queries** (3 tests): Get game by ID, player lookup, ready check
- ✅ **Powerup Cards** (3 tests): Capacity increase, bug/debug mechanics
- ✅ **Validation** (1 test): Program node limits
- ✅ **Container Nesting** (13 tests): For loop restrictions, if block restrictions, capacity requirements
- ✅ **Game Deletion** (1 test): Memory cleanup

## Key Features Tested

### Card Execution

- All card types: attack, heal, energy, dodge, hide
- Control structures: for loops, if statements
- Energy consumption and blocking
- HP limits and healing caps

### Game Mechanics

- Turn-based execution with simultaneous resolution
- Energy system (0-3 range)
- HP system (0-10 range with healing cap)
- Event generation and deduplication

### Player Interactions

- Multiplayer socket events
- Leave and disconnect handling
- Game over detection
- Powerup mechanics (capacity increase, bug/debug)

### Edge Cases

- Empty programs
- Nested containers
- Insufficient energy
- Full/empty hands
- Bugged cards

## Running Specific Tests

Focus on a single test file:

```bash
npm test execution.test.js
npm test game.service.test.js
npm test socket.handler.test.js
```

Focus on a single test:

```javascript
it.only("should test specific behavior", () => { ... });
```
