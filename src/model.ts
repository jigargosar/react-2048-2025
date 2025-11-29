// ============================================
// IMPORTS
// ============================================
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
    value: number // clearer: the value before merge
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

export const TOTAL_TILES = CONFIG.gridSize * CONFIG.gridSize

// ============================================
// MODEL - Pure Game Logic
// ============================================

type MaybeTile = Tile | null
type Positions = readonly Position[]
type MaybeTiles = readonly MaybeTile[]
type MatrixMaybeTile = Matrix<MaybeTile>
export type ScoreDeltas = readonly number[]
export type Random = () => number

// Position matrix
const POSITION_MATRIX: Matrix<Position> = times(
    (row) => times((col) => ({ row, col }), CONFIG.gridSize),
    CONFIG.gridSize,
)
export const ALL_POSITIONS: Positions = POSITION_MATRIX.flat()

// ============================================
// TILE STATE OPS
// ============================================

const TileOps = {
    static: (t: Tile): Tile => ({ ...t, state: { type: 'static' } }),
    moved: (t: Tile): Tile => ({
        ...t,
        state: { type: 'moved', from: t.position },
    }),
    merged: (a: Tile, b: Tile): Tile => ({
        value: a.value * 2, // <-- always the display value
        position: a.position,
        state: {
            type: 'merged',
            from1: a.position,
            from2: b.position,
            value: a.value, // <-- used only for animation logic
        },
    }),
    spawned: (pos: Position, value: number): Tile => ({
        position: pos,
        value,
        state: { type: 'spawned' },
    }),
}

// ============================================
// MATRIX OPS
// ============================================

function tilesToMatrix(tiles: Tiles): MatrixMaybeTile {
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
    return matrix.map((row, r) =>
        row.map((tile, c) =>
            tile ? { ...tile, position: { row: r, col: c } } : null,
        ),
    )
}

// ============================================
// SLIDE + MERGE ROW
// ============================================

function slideAndMergeRowLeft(row: MaybeTiles): MaybeTiles {
    const compact = keepNonNil(row)
    const merged: Tile[] = []

    for (let i = 0; i < compact.length; i++) {
        const current = compact[i]
        const next = compact[i + 1]

        if (current && next && current.value === next.value) {
            merged.push(TileOps.merged(current, next))
            i++ // skip next
        } else if (current) {
            // static if same index, moved otherwise
            merged.push(
                i === row.indexOf(current)
                    ? TileOps.static(current)
                    : TileOps.moved(current),
            )
        }
    }

    const nullCount = CONFIG.gridSize - merged.length
    const nulls: MaybeTile[] = repeat(null, nullCount)
    return [...merged, ...nulls]
}

// ============================================
// SLIDE MATRIX
// ============================================

function slideLeft(matrix: MatrixMaybeTile): MatrixMaybeTile {
    return matrix.map(slideAndMergeRowLeft)
}

function slideAndMergeMatrix(
    matrix: MatrixMaybeTile,
    dir: Direction,
): MatrixMaybeTile {
    switch (dir) {
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

function slideAndMergeTiles(tiles: Tiles, dir: Direction): Tiles {
    return pipe(
        tiles,
        tilesToMatrix,
        (m) => slideAndMergeMatrix(m, dir),
        setPositionsFromMatrix,
        flatten,
        keepNonNil,
    )
}

// ============================================
// SPAWN LOGIC
// ============================================

function getEmptyPositions(tiles: Tiles): Positions {
    const matrix = tilesToMatrix(tiles)
    return ALL_POSITIONS.filter((p) => matrix[p.row]?.[p.col] === null)
}

function spawnRandomTiles(tiles: Tiles, random: Random): Tiles {
    const empty = getEmptyPositions(tiles).slice()
    const newTiles = [...tiles]

    for (let i = 0; i < CONFIG.tilesToSpawnPerMove && empty.length > 0; i++) {
        const idx = Math.floor(random() * empty.length)
        const pos = empty.splice(idx, 1)[0]
        if (pos) {
            newTiles.push(TileOps.spawned(pos, random() < 0.9 ? 2 : 4))
        }
    }
    return newTiles
}

// ============================================
// SCORE + STATUS CHECKS
// ============================================

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
    // If board is not full, there are still moves available
    if (tiles.length < CONFIG.gridSize * CONFIG.gridSize) {
        return false
    }

    const dirs: Array<[number, number]> = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
    ]
    const matrix = tilesToMatrix(tiles)

    return tiles.every(
        ({ position: { row, col }, value }) =>
            !dirs.some(
                ([dr, dc]) => matrix[row + dr]?.[col + dc]?.value === value,
            ),
    )
}

// ============================================
// MODEL TYPES + INITIAL STATE
// ============================================

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

// ============================================
// MODEL HELPERS
// ============================================

export function continueGameModel(model: Model): Model {
    return model.gameStatus === 'won'
        ? { ...model, gameStatus: 'continue' }
        : model
}

export function prepareMove(model: Model): MaybeModel {
    if (['won', 'over'].includes(model.gameStatus)) return null
    return { ...model, tiles: model.tiles.map(TileOps.static) }
}

// ============================================
// MAIN MOVE FUNCTION
// ============================================

export function move(model: Model, dir: Direction, random: Random): MaybeModel {
    if (['won', 'over'].includes(model.gameStatus)) return null

    const moved = slideAndMergeTiles(model.tiles, dir)
    if (moved.every((t) => t.state.type === 'static')) {
        return noMovesLeft(model.tiles)
            ? { ...model, gameStatus: 'over' }
            : null
    }

    const scoreDelta = scoreFromTiles(moved)
    const newDeltas = [...model.scoreDeltas, scoreDelta]
    const newScore = sumScoreDeltas(newDeltas)
    const bestScore = Math.max(model.bestScore, newScore)

    // Win check first — no spawn if won
    if (model.gameStatus === 'playing' && hasWinningTile(moved)) {
        return {
            ...model,
            tiles: moved,
            scoreDeltas: newDeltas,
            bestScore,
            gameStatus: 'won',
        }
    }

    // Spawn new tiles
    const spawned = spawnRandomTiles(moved, random)
    const newStatus = noMovesLeft(spawned) ? 'over' : model.gameStatus

    return {
        ...model,
        tiles: spawned,
        scoreDeltas: newDeltas,
        bestScore,
        gameStatus: newStatus,
    }
}

// ============================================
// TEST HELPERS
// ============================================

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
