import { pipe } from 'fp-ts/function'
import { flatten, repeat, times } from 'ramda'
import { keepNonNil, type Matrix, reverseRows, transpose } from './utils.ts'

// ============================================
// SHARED TYPES & CONSTANTS
// ============================================

export type Position = Readonly<{ row: number; col: number }>
export type Direction = 'left' | 'right' | 'up' | 'down'

export type StaticState = Readonly<{ type: 'static' }>
export type MovedState = Readonly<{ type: 'moved'; from: Position }>
export type SpawnedState = Readonly<{ type: 'spawned' }>
export type MergedState = Readonly<{
    type: 'merged'
    from1: Position
    from2: Position
    value: number
}>
export type TileState = StaticState | MovedState | MergedState | SpawnedState

export type Tile = Readonly<{
    position: Position
    value: number
    state: TileState
}>
export type Tiles = readonly Tile[]

export const CONFIG = {
    gridSize: 4,
    tileSizePx: 100,
    tilesToSpawnPerMove: 2,
    winValue: 2048,
    minSwipeDetectDistancePx: 30,
    localStorageBestScoreKey: 'bestScore',
}

// ============================================
// MODEL - Pure Game Logic
// ============================================

// Model-only types
type MaybeTile = Tile | null
type Positions = readonly Position[]
type MaybeTiles = readonly MaybeTile[]
type MatrixMaybeTile = Matrix<MaybeTile>
export type ScoreDeltas = readonly number[]
export type Random = () => number

// Model-only constants
const POSITION_MATRIX: Matrix<Position> = times(
    (row) => times((col) => ({ row, col }), CONFIG.gridSize),
    CONFIG.gridSize,
)
export const ALL_POSITIONS: Positions = POSITION_MATRIX.flat()

// Tile state transformations
function setTileStateToStatic(tile: Tile): Tile {
    return { ...tile, state: { type: 'static' } }
}

function setTileStateToMoved(tile: Tile): Tile {
    return {
        ...tile,
        state: { type: 'moved', from: tile.position },
    }
}

function createMergedTile(tile1: Tile, tile2: Tile): Tile {
    return {
        value: tile1.value * 2,
        position: tile1.position,
        state: {
            type: 'merged',
            from1: tile1.position,
            from2: tile2.position,
            value: tile1.value,
        },
    }
}

function createSpawnedTile(position: Position, value: number): Tile {
    return { value, position, state: { type: 'spawned' } }
}

// Matrix operations
function tilesToMatrix(tiles: Tiles): MatrixMaybeTile {
    // Not using MatrixMaybeTile - needs mutable array during construction
    const matrix: MaybeTile[][] = times(
        () => repeat(null, CONFIG.gridSize),
        CONFIG.gridSize,
    )
    for (const tile of tiles) {
        const row = matrix[tile.position.row]
        if (row) {
            row[tile.position.col] = tile
        }
    }

    return matrix
}

function setPositionsFromMatrix(matrix: MatrixMaybeTile): MatrixMaybeTile {
    return matrix.map((row, rowIndex) =>
        row.map((tile, colIndex) => {
            if (tile === null) return null
            return {
                ...tile,
                position: { row: rowIndex, col: colIndex },
            }
        }),
    )
}

// Slide and merge logic
function slideAndMergeRowLeft(row: MaybeTiles): MaybeTiles {
    // Filter non-null tiles and keep their original indices
    const nonNullTiles: Array<{ tile: Tile; originalIndex: number }> = []
    for (let i = 0; i < row.length; i++) {
        const tile = row[i]
        if (tile != null) {
            nonNullTiles.push({ tile, originalIndex: i })
        }
    }

    // Not using MaybeTiles - needs mutable array during construction
    const result: MaybeTile[] = repeat(null, CONFIG.gridSize)
    let writePos = 0

    for (const { tile, originalIndex } of nonNullTiles) {
        const prevTile = result[writePos - 1]

        const canMerge =
            prevTile &&
            prevTile.state.type !== 'merged' &&
            prevTile.value === tile.value

        if (canMerge) {
            // Merge: replace previous tile with merged version
            result[writePos - 1] = createMergedTile(prevTile, tile)
        } else {
            // No merge: determine state and write tile
            result[writePos] =
                writePos === originalIndex
                    ? setTileStateToStatic(tile)
                    : setTileStateToMoved(tile)
            writePos++
        }
    }

    return result
}

function slideLeft(matrix: MatrixMaybeTile): MatrixMaybeTile {
    return matrix.map(slideAndMergeRowLeft)
}

function slideAndMergeMatrix(
    matrix: MatrixMaybeTile,
    direction: Direction,
): MatrixMaybeTile {
    switch (direction) {
        case 'left':
            return slideLeft(matrix)
        case 'right':
            return pipe(matrix, reverseRows, slideLeft, reverseRows)
        case 'up':
            return pipe(matrix, transpose, slideLeft, transpose)
        case 'down':
            return pipe(
                matrix,
                transpose,
                reverseRows,
                slideLeft,
                reverseRows,
                transpose,
            )
    }
}

function slideAndMergeTiles(tiles: Tiles, direction: Direction): Tiles {
    return pipe(
        tiles,
        tilesToMatrix,
        (matrix) => slideAndMergeMatrix(matrix, direction),
        setPositionsFromMatrix,
        flatten,
        keepNonNil,
    )
}

// Tile spawning
function getEmptyPositions(tiles: Tiles): Positions {
    const matrix = tilesToMatrix(tiles)
    return ALL_POSITIONS.filter((p) => matrix[p.row]?.[p.col] === null)
}

function spawnRandomTiles(tiles: Tiles, count: number, random: Random): Tiles {
    let emptyPositions = getEmptyPositions(tiles)
    const newTiles = [...tiles]

    for (let i = 0; i < count && emptyPositions.length > 0; i++) {
        const randomIndex = Math.floor(random() * emptyPositions.length)
        const position = emptyPositions[randomIndex]
        if (position) {
            const value = random() < 0.9 ? 2 : 4
            newTiles.push(createSpawnedTile(position, value))
            emptyPositions = emptyPositions.filter(
                (_, idx) => idx !== randomIndex,
            )
        }
    }

    return newTiles
}

function scoreFromTiles(tiles: Tiles): number {
    return tiles
        .filter((t) => t.state.type === 'merged')
        .reduce((sum, t) => sum + t.value, 0)
}

export function sumScoreDeltas(deltas: ScoreDeltas): number {
    return deltas.reduce((a, b) => a + b, 0)
}

function hasWinningTile(tiles: Tiles): boolean {
    return tiles.some((t) => t.value >= CONFIG.winValue)
}

function noMovesLeft(tiles: Tiles): boolean {
    const directions: Array<[number, number]> = [[0, 1], [1, 0], [0, -1], [-1, 0]]
    const matrix = tilesToMatrix(tiles)

    const hasNoMatchingNeighbor = ({ position: { row, col }, value }: Tile) => {
        const hasMatch = directions.some(([dr, dc]) =>
            matrix[row + dr]?.[col + dc]?.value === value
        )
        return !hasMatch
    }

    return tiles.every(hasNoMatchingNeighbor)
}

// Model state type
export type GameStatus = 'playing' | 'won' | 'continue' | 'over'

export type Model = {
    tiles: Tiles
    scoreDeltas: ScoreDeltas
    gameStatus: GameStatus
    bestScore: number
}

export type MaybeModel = Model | null

export const INITIAL_MODEL: Model = {
    tiles: [
        { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
        { value: 4, position: { row: 0, col: 2 }, state: { type: 'static' } },
        { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
        { value: 8, position: { row: 2, col: 3 }, state: { type: 'static' } },
        { value: 2, position: { row: 3, col: 2 }, state: { type: 'static' } },
    ],
    scoreDeltas: [],
    gameStatus: 'playing',
    bestScore: 0,
}

// Model update functions
export function continueGameModel(model: Model): Model {
    if (model.gameStatus !== 'won') return model
    return { ...model, gameStatus: 'continue' }
}

export function createTestWinModel(model: Model): Model {
    return {
        ...model,
        tiles: [
            {
                value: 1024,
                position: { row: 0, col: 0 },
                state: { type: 'static' },
            },
            {
                value: 1024,
                position: { row: 0, col: 1 },
                state: { type: 'static' },
            },
        ],
        gameStatus: 'playing',
        scoreDeltas: [],
    }
}

export function createTestGameOverModel(model: Model): Model {
    const tiles: Tiles = ALL_POSITIONS.map((position) => ({
        value: (position.row + position.col) % 2 === 0 ? 2 : 4,
        position,
        state: { type: 'static' },
    }))
    return {
        ...model,
        tiles,
        gameStatus: 'playing',
        scoreDeltas: [],
    }
}

export function createAllTestTilesModel(model: Model): Model {
    const values = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]
    const tiles: Tiles = keepNonNil(
        values.map((value, index) => {
            const position = ALL_POSITIONS[index]
            if (!position) return null
            return {
                value,
                position,
                state: { type: 'static' },
            }
        }),
    )
    return {
        ...model,
        tiles,
        gameStatus: 'playing',
        scoreDeltas: [],
    }
}

export function prepareMove(model: Model): MaybeModel {
    if (['won', 'over'].includes(model.gameStatus)) {
        return null
    }
    return { ...model, tiles: model.tiles.map(setTileStateToStatic) }
}

export function move(
    model: Model,
    direction: Direction,
    random: Random,
): MaybeModel {
    if (['won', 'over'].includes(model.gameStatus)) {
        return null
    }

    const movedTiles = slideAndMergeTiles(model.tiles, direction)
    const allStatic = movedTiles.every((t) => t.state.type === 'static')
    if (allStatic) {
        if (noMovesLeft(model.tiles)) {
            return {
                ...model,
                gameStatus: 'over',
            }
        }
        return null
    }

    const scoreDelta = scoreFromTiles(movedTiles)
    const newDeltas = [...model.scoreDeltas, scoreDelta]
    const newScore = sumScoreDeltas(newDeltas)
    const newBestScore = Math.max(model.bestScore, newScore)

    // Check win first - no spawn on win
    if (model.gameStatus === 'playing' && hasWinningTile(movedTiles)) {
        return {
            ...model,
            tiles: movedTiles,
            scoreDeltas: newDeltas,
            bestScore: newBestScore,
            gameStatus: 'won',
        }
    }

    // Spawn tile and check game over
    const tilesAfterSpawn = spawnRandomTiles(
        movedTiles,
        CONFIG.tilesToSpawnPerMove,
        random,
    )
    const newGameStatus = noMovesLeft(tilesAfterSpawn) ? 'over' : model.gameStatus

    return {
        ...model,
        tiles: tilesAfterSpawn,
        scoreDeltas: newDeltas,
        bestScore: newBestScore,
        gameStatus: newGameStatus,
    }
}
