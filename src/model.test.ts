import { describe, expect, test } from 'vitest'
import * as fc from 'fast-check'
import {
    CONFIG,
    Direction,
    GameStatus,
    type Model,
    move,
    type ScoreDeltas,
    TOTAL_TILES,
} from './model'

// Helper to create a deterministic random function
const createMockRandom = (values: readonly number[]) => {
    let index = 0
    return (): number => {
        const val = values[index % values.length]
        index++
        return val ?? 0
    }
}

// Helper to create board from readable pattern
// 0 represents empty tile
// Example: createBoard([[2, 4, 0, 2], [4, 0, 2, 4], ...])
const createBoard = (pattern: ReadonlyArray<ReadonlyArray<number>>): Model['tiles'] => {
    const tiles: Array<{
        value: number
        position: { row: number; col: number }
        state: { type: 'static' }
    }> = []
    for (let row = 0; row < pattern.length; row++) {
        const rowPattern = pattern[row]
        if (!rowPattern) continue
        for (let col = 0; col < rowPattern.length; col++) {
            const value = rowPattern[col]
            if (value && value !== 0) {
                tiles.push({
                    value,
                    position: { row, col },
                    state: { type: 'static' },
                })
            }
        }
    }
    return tiles
}

// Helper to create a complete Model from readable pattern
const createModel = (
    pattern: ReadonlyArray<ReadonlyArray<number>>,
    options: {
        scoreDeltas: ScoreDeltas
        gameStatus: GameStatus
        bestScore: number
    },
): Model => ({
    tiles: createBoard(pattern),
    scoreDeltas: options.scoreDeltas,
    gameStatus: options.gameStatus,
    bestScore: options.bestScore,
})

describe('2048 Game Logic', () => {
    describe('move function - game over detection', () => {
        test('should NOT end game when board is not full', () => {
            // Board with 10 tiles, no merges possible, but not full
            const model = createModel(
                [
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                    [2, 4, 0, 0],
                ],
                {
                    scoreDeltas: [],
                    gameStatus: GameStatus.playing,
                    bestScore: 0,
                },
            )

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, Direction.down, random)

            // Should not be game over - board is not full
            expect(result).not.toBeNull()
            expect(result?.gameStatus).not.toBe(GameStatus.over)
        })

        test('should end game when board is full and no moves possible', () => {
            const model = createModel(
                [
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                ],
                {
                    scoreDeltas: [],
                    gameStatus: GameStatus.playing,
                    bestScore: 0,
                },
            )

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, Direction.down, random)

            // Full board, no moves possible → game over
            expect(result).not.toBeNull()
            if (result) {
                expect(result.tiles.length).toBe(TOTAL_TILES)
                expect(result.gameStatus).toBe(GameStatus.over)
            }
        })

        test('should merge tiles correctly', () => {
            const model = createModel([[2, 2, 0, 0]], {
                scoreDeltas: [],
                gameStatus: GameStatus.playing,
                bestScore: 0,
            })

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, Direction.left, random)

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
            const model = createModel([[2, 2, 2, 2]], {
                scoreDeltas: [],
                gameStatus: GameStatus.playing,
                bestScore: 0,
            })

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, Direction.left, random)

            expect(result).not.toBeNull()
            if (result) {
                // Should merge into two 4 tiles, not one 8 tile
                const fourTiles = result.tiles.filter(
                    (t) => t.value === 4 && t.state.type === 'merged',
                )
                expect(fourTiles.length).toBe(2)
            }
        })

        test('should spawn tiles after successful move', () => {
            const model = createModel([[0, 2, 0, 0]], {
                scoreDeltas: [],
                gameStatus: GameStatus.playing,
                bestScore: 0,
            })

            const random = createMockRandom([0.5, 0.5])
            const result = move(model, Direction.left, random)

            expect(result).not.toBeNull()
            if (result) {
                // Tile moved from col 1 to col 0, then spawned new tiles
                const spawnedTiles = result.tiles.filter(
                    (t) => t.state.type === 'spawned',
                )
                expect(spawnedTiles.length).toBe(CONFIG.tilesToSpawnPerMove)
            }
        })

        test('should NOT declare game over when board not full (nothing moves case)', () => {
            // BUG: When move fails (all tiles static) and board has 15 tiles with no merges,
            // noMovesLeft returns true → game over, even though there's an empty space
            const model = createModel(
                [
                    [2, 4, 2, 0], // 1 empty space
                    [4, 2, 4, 2],
                    [2, 4, 2, 4],
                    [4, 2, 4, 2],
                ],
                {
                    scoreDeltas: [],
                    gameStatus: GameStatus.playing,
                    bestScore: 0,
                },
            )

            const random = createMockRandom([0.5, 0.5])

            // Try to move down - nothing will move (tiles already at bottom or blocked)
            const result = move(model, Direction.down, random)

            // Bug: Returns game over even though board has 1 empty space
            // Expected: null (invalid move) since board isn't full
            expect(result).toBeNull()
        })
    })

    describe('move function - property-based tests', () => {
        // Generator for random tile values (powers of 2)
        const tileValueArb = fc.constantFrom(2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048)

        // Generator for random positions within grid
        const positionArb = fc.record({
            row: fc.integer({ min: 0, max: 3 }),
            col: fc.integer({ min: 0, max: 3 }),
        })

        // Generator for random tiles (avoiding duplicates at same position)
        const tilesArb = fc
            .array(
                fc.record({
                    value: tileValueArb,
                    position: positionArb,
                }),
                { maxLength: 12 },
            )
            .map((tiles) => {
                // Remove duplicate positions
                const seen = new Set<string>()
                return tiles
                    .filter((t) => {
                        const key = `${t.position.row},${t.position.col}`
                        if (seen.has(key)) return false
                        seen.add(key)
                        return true
                    })
                    .map((t) => ({ ...t, state: { type: 'static' as const } }))
            })

        const directionArb = fc.constantFrom(Direction.up, Direction.down, Direction.left, Direction.right)

        test('moving never creates out-of-bounds positions', () => {
            fc.assert(
                fc.property(tilesArb, directionArb, (tiles, dir) => {
                    const model = createModel(
                        [
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                        ],
                        {
                            scoreDeltas: [],
                            gameStatus: GameStatus.playing,
                            bestScore: 0,
                        },
                    )
                    // Override tiles with random ones
                    const testModel = { ...model, tiles }
                    const random = createMockRandom([0.5, 0.5])
                    const result = move(testModel, dir, random)

                    if (!result) return true

                    return result.tiles.every(
                        (t) => t.position.row >= 0 && t.position.row < 4 && t.position.col >= 0 && t.position.col < 4,
                    )
                }),
            )
        })

        test('merged tiles always have value equal to double the original', () => {
            fc.assert(
                fc.property(tilesArb, directionArb, (tiles, dir) => {
                    const model = createModel(
                        [
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                        ],
                        {
                            scoreDeltas: [],
                            gameStatus: GameStatus.playing,
                            bestScore: 0,
                        },
                    )
                    const testModel = { ...model, tiles }
                    const random = createMockRandom([0.5, 0.5])
                    const result = move(testModel, dir, random)

                    if (!result) return true

                    return result.tiles
                        .filter((t) => t.state.type === 'merged')
                        .every((t) => {
                            if (t.state.type !== 'merged') return true
                            return t.state.value * 2 === t.value
                        })
                }),
            )
        })

        test('score deltas are always non-negative', () => {
            fc.assert(
                fc.property(tilesArb, directionArb, (tiles, dir) => {
                    const model = createModel(
                        [
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                            [0, 0, 0, 0],
                        ],
                        {
                            scoreDeltas: [],
                            gameStatus: GameStatus.playing,
                            bestScore: 0,
                        },
                    )
                    const testModel = { ...model, tiles }
                    const random = createMockRandom([0.5, 0.5])
                    const result = move(testModel, dir, random)

                    if (!result) return true

                    return result.scoreDeltas.every((delta) => delta >= 0)
                }),
            )
        })
    })
})
