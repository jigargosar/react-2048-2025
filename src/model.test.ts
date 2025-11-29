import { describe, expect, test } from 'vitest'
import { move, type Model, CONFIG } from './model'

// Helper to create a deterministic random function
const createMockRandom = (values: readonly number[]) => {
    let index = 0
    return (): number => {
        const val = values[index % values.length]
        index++
        return val ?? 0
    }
}

describe('2048 Game Logic', () => {
    describe('move function - game over detection', () => {
        test('should NOT end game when board is not full', () => {
            // Board with 10 tiles, no merges possible, but not full
            const model: Model = {
                tiles: [
                    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 0, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 2 }, state: { type: 'static' } },
                    { value: 4, position: { row: 0, col: 3 }, state: { type: 'static' } },
                    { value: 4, position: { row: 1, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
                    { value: 4, position: { row: 1, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 3 }, state: { type: 'static' } },
                    { value: 2, position: { row: 2, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 2, col: 1 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, 'down', random)

            // Should not be game over - board is not full
            expect(result).not.toBeNull()
            if (result) {
                expect(result.gameStatus).not.toBe('over')
            }
        })

        test('should end game when board is full and no moves possible', () => {
            // Create a full board (16 tiles) with no possible merges
            const model: Model = {
                tiles: [
                    // Row 0: 2, 4, 2, 4
                    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 0, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 2 }, state: { type: 'static' } },
                    { value: 4, position: { row: 0, col: 3 }, state: { type: 'static' } },
                    // Row 1: 4, 2, 4, 2
                    { value: 4, position: { row: 1, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
                    { value: 4, position: { row: 1, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 3 }, state: { type: 'static' } },
                    // Row 2: 2, 4, 2, 4
                    { value: 2, position: { row: 2, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 2, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 2, col: 2 }, state: { type: 'static' } },
                    { value: 4, position: { row: 2, col: 3 }, state: { type: 'static' } },
                    // Row 3: 4, 2, 4, 2
                    { value: 4, position: { row: 3, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 3, col: 1 }, state: { type: 'static' } },
                    { value: 4, position: { row: 3, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 3, col: 3 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, 'down', random)

            // Nothing moves, board is full, no merges possible
            expect(result).not.toBeNull()
            if (result) {
                expect(result.gameStatus).toBe('over')
            }
        })

        test('should merge tiles correctly', () => {
            const model: Model = {
                tiles: [
                    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 1 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, 'left', random)

            expect(result).not.toBeNull()
            if (result) {
                // Should have merged to one 4 tile plus spawned tiles
                const mergedTile = result.tiles.find((t) => t.value === 4)
                expect(mergedTile).toBeDefined()
                expect(mergedTile?.position).toEqual({ row: 0, col: 0 })
                expect(mergedTile?.state.type).toBe('merged')
            }
        })

        test('should not merge same tile twice', () => {
            const model: Model = {
                tiles: [
                    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 3 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, 'left', random)

            expect(result).not.toBeNull()
            if (result) {
                // Should merge into two 4 tiles, not one 8 tile
                const fourTiles = result.tiles.filter((t) => t.value === 4 && t.state.type === 'merged')
                expect(fourTiles.length).toBe(2)
            }
        })

        test('should spawn tiles after successful move', () => {
            const model: Model = {
                tiles: [
                    { value: 2, position: { row: 0, col: 1 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, 'left', random)

            expect(result).not.toBeNull()
            if (result) {
                // Tile moved from col 1 to col 0, then spawned new tiles
                const spawnedTiles = result.tiles.filter((t) => t.state.type === 'spawned')
                expect(spawnedTiles.length).toBe(CONFIG.tilesToSpawnPerMove)
            }
        })

        test('should NOT declare game over when board not full (nothing moves case)', () => {
            // BUG: When move fails (all tiles static) and board has 15 tiles with no merges,
            // noMovesLeft returns true → game over, even though there's an empty space

            // Create 15 tiles in a pattern where:
            // 1. No merges possible (alternating 2,4)
            // 2. Nothing can move down (already at bottom or blocked)
            const model: Model = {
                tiles: [
                    // Bottom rows filled, top row has 1 empty - total 15 tiles
                    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 0, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 0, col: 2 }, state: { type: 'static' } },
                    // row 0, col 3 is EMPTY

                    { value: 4, position: { row: 1, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
                    { value: 4, position: { row: 1, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 1, col: 3 }, state: { type: 'static' } },

                    { value: 2, position: { row: 2, col: 0 }, state: { type: 'static' } },
                    { value: 4, position: { row: 2, col: 1 }, state: { type: 'static' } },
                    { value: 2, position: { row: 2, col: 2 }, state: { type: 'static' } },
                    { value: 4, position: { row: 2, col: 3 }, state: { type: 'static' } },

                    { value: 4, position: { row: 3, col: 0 }, state: { type: 'static' } },
                    { value: 2, position: { row: 3, col: 1 }, state: { type: 'static' } },
                    { value: 4, position: { row: 3, col: 2 }, state: { type: 'static' } },
                    { value: 2, position: { row: 3, col: 3 }, state: { type: 'static' } },
                ],
                scoreDeltas: [],
                gameStatus: 'playing',
                bestScore: 0,
            }

            const random = createMockRandom([0.5, 0.5])

            // Try to move down - nothing will move because tiles are already at bottom
            const result = move(model, 'down', random)

            // Bug triggers here: move returns game over status even though board has 1 empty space
            // Expected: should return null (invalid move) since board isn't full
            expect(result).toBeNull()
        })
    })
})
