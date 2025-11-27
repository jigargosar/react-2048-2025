import type React from 'react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { pipe } from 'fp-ts/function'
import { flatten, inc, repeat, times } from 'ramda'
import {
    createSeededRandom,
    keepNonNil,
    type Matrix,
    reverseRows,
    transpose,
} from './utils.ts'

// ============================================
// SHARED TYPES & CONSTANTS
// ============================================

type Position = Readonly<{ row: number; col: number }>
type Direction = 'left' | 'right' | 'up' | 'down'

type StaticState = Readonly<{ type: 'static' }>
type MovedState = Readonly<{ type: 'moved'; from: Position }>
type SpawnedState = Readonly<{ type: 'spawned' }>
type MergedState = Readonly<{
    type: 'merged'
    from1: Position
    from2: Position
    value: number
}>
type TileState = StaticState | MovedState | MergedState | SpawnedState

type Tile = Readonly<{
    position: Position
    value: number
    state: TileState
}>
type Tiles = readonly Tile[]

const CONFIG = {
    gridSize: 4,
    tileSizePx: 100,
    tilesToSpawnPerMove: 1,
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
type ScoreDeltas = readonly number[]
type Random = () => number
type MoveResult = { tiles: Tiles; scoreDelta: number }

// Model-only constants
const POSITION_MATRIX: Matrix<Position> = times(
    (row) => times((col) => ({ row, col }), CONFIG.gridSize),
    CONFIG.gridSize,
)
const ALL_POSITIONS: Positions = POSITION_MATRIX.flat()

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
    const matrix: MaybeTile[][] = times(() => repeat(null, CONFIG.gridSize), CONFIG.gridSize)
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

// Game state checks
function computeScoreDelta(tiles: Tiles): number {
    return tiles
        .filter((t) => t.state.type === 'merged')
        .reduce((sum, t) => sum + t.value, 0)
}

function sumScoreDeltas(deltas: ScoreDeltas): number {
    return deltas.reduce((a, b) => a + b, 0)
}

function hasWon(tiles: Tiles): boolean {
    return tiles.some((t) => t.value >= CONFIG.winValue)
}

function canMove(tiles: Tiles): boolean {
    // Has empty cell
    if (tiles.length < CONFIG.gridSize * CONFIG.gridSize) return true

    // Has adjacent matching tiles
    const matrix = tilesToMatrix(tiles)
    for (let row = 0; row < CONFIG.gridSize; row++) {
        for (let col = 0; col < CONFIG.gridSize; col++) {
            const tile = matrix[row]?.[col]
            if (!tile) continue
            const right = matrix[row]?.[col + 1]
            const down = matrix[row + 1]?.[col]
            if (right && right.value === tile.value) return true
            if (down && down.value === tile.value) return true
        }
    }
    return false
}

function isGameOver(tiles: Tiles): boolean {
    return !canMove(tiles)
}

// Main move function
function move(tiles: Tiles, direction: Direction): MoveResult {
    const movedTiles = slideAndMergeTiles(tiles, direction)
    const allStatic = movedTiles.every((t) => t.state.type === 'static')
    if (allStatic) return { tiles, scoreDelta: 0 }

    const scoreDelta = computeScoreDelta(movedTiles)
    return { tiles: movedTiles, scoreDelta }
}

// Input parsing
function parseDirectionFromKey(key: string): Direction | null {
    switch (key) {
        case 'ArrowLeft':
            return 'left'
        case 'ArrowRight':
            return 'right'
        case 'ArrowUp':
            return 'up'
        case 'ArrowDown':
            return 'down'
        default:
            return null
    }
}

function parseDirectionFromSwipe(deltaX: number, deltaY: number): Direction | null {
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX < CONFIG.minSwipeDetectDistancePx && absY < CONFIG.minSwipeDetectDistancePx) return null

    if (absX > absY) {
        return deltaX > 0 ? 'right' : 'left'
    } else {
        return deltaY > 0 ? 'down' : 'up'
    }
}

// ============================================
// HOOK - State Management & Coordination
// ============================================

// Hook-only types
type GameStatus = 'playing' | 'won' | 'continue' | 'over'

type InitialState = {
    tiles: Tiles
    scoreDeltas: ScoreDeltas
    renderCounter: number
    randomSeed: number
    gameStatus: GameStatus
}

// Hook-only constants
const INITIAL_STATE: InitialState = {
    tiles: [
        { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
        { value: 4, position: { row: 0, col: 2 }, state: { type: 'static' } },
        { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
        { value: 8, position: { row: 2, col: 3 }, state: { type: 'static' } },
        { value: 2, position: { row: 3, col: 2 }, state: { type: 'static' } },
    ],
    scoreDeltas: [],
    renderCounter: 0,
    randomSeed: 1,
    gameStatus: 'playing',
}

// LocalStorage utilities
function loadBestScore(): number {
    const stored = localStorage.getItem(CONFIG.localStorageBestScoreKey)
    return stored ? Number(stored) : 0
}

function saveBestScore(score: number): void {
    localStorage.setItem(CONFIG.localStorageBestScoreKey, String(score))
}

// Main hook
function useTileSlide(gridRef: React.RefObject<HTMLDivElement | null>) {
    const [tiles, setTiles] = useState<Tiles>(INITIAL_STATE.tiles)
    const [renderCounter, setRenderCounter] = useState(INITIAL_STATE.renderCounter)
    const [scoreDeltas, setScoreDeltas] = useState<ScoreDeltas>(INITIAL_STATE.scoreDeltas)
    const [gameStatus, setGameStatus] = useState<GameStatus>(INITIAL_STATE.gameStatus)
    const [bestScore, setBestScore] = useState(loadBestScore)
    const randomRef = useRef(createSeededRandom(INITIAL_STATE.randomSeed))

    const resetGame = () => {
        setTiles(INITIAL_STATE.tiles)
        setRenderCounter(INITIAL_STATE.renderCounter)
        setScoreDeltas(INITIAL_STATE.scoreDeltas)
        setGameStatus(INITIAL_STATE.gameStatus)
        randomRef.current = createSeededRandom(INITIAL_STATE.randomSeed)
    }

    const continueGame = () => {
        if (gameStatus !== 'won') return
        setGameStatus('continue')
    }

    const setUpTestWin = () => {
        const tiles: Tiles = [
            { value: 1024, position: { row: 0, col: 0 }, state: { type: 'static' } },
            { value: 1024, position: { row: 0, col: 1 }, state: { type: 'static' } },
        ]
        setTiles(tiles)
        setGameStatus('playing')
        setScoreDeltas([])
    }

    const setUpTestGameOver = () => {
        const tiles: Tiles = ALL_POSITIONS.map((position) => ({
            value: (position.row + position.col) % 2 === 0 ? 2 : 4,
            position,
            state: { type: 'static' },
        }))
        setTiles(tiles)
        setGameStatus('playing')
        setScoreDeltas([])
    }

    const setUpTestTiles = () => {
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
            })
        )
        setTiles(tiles)
        setGameStatus('playing')
        setScoreDeltas([])
    }

    const onMove = useEffectEvent((direction: Direction) => {
        if (gameStatus === 'won' || gameStatus === 'over') return

        const staticTiles = tiles.map(setTileStateToStatic)
        setTiles(staticTiles)
        setRenderCounter(inc)
        requestAnimationFrame(() => {
            const result = move(staticTiles, direction)
            if (result.scoreDelta > 0) {
                setScoreDeltas((deltas) => {
                    const newDeltas = [...deltas, result.scoreDelta]
                    const newScore = sumScoreDeltas(newDeltas)
                    if (newScore > bestScore) {
                        setBestScore(newScore)
                        saveBestScore(newScore)
                    }
                    return newDeltas
                })
            }

            // Check win first - no spawn on win
            if (gameStatus === 'playing' && hasWon(result.tiles)) {
                setTiles(result.tiles)
                setGameStatus('won')
                return
            }

            // Spawn tile and check game over
            const tilesAfterSpawn = spawnRandomTiles(result.tiles, CONFIG.tilesToSpawnPerMove, randomRef.current)
            setTiles(tilesAfterSpawn)
            if (isGameOver(tilesAfterSpawn)) {
                setGameStatus('over')
            }
        })
    })

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const direction = parseDirectionFromKey(event.key)
            if (direction) onMove(direction)
        }

        let pointerStart: { x: number; y: number } | null = null

        function handlePointerDown(event: PointerEvent) {
            pointerStart = { x: event.clientX, y: event.clientY }
        }

        function handlePointerUp(event: PointerEvent) {
            if (!pointerStart) return

            const deltaX = event.clientX - pointerStart.x
            const deltaY = event.clientY - pointerStart.y
            pointerStart = null

            const direction = parseDirectionFromSwipe(deltaX, deltaY)
            if (direction) onMove(direction)
        }

        const grid = gridRef.current
        window.addEventListener('keydown', handleKeyDown)
        grid?.addEventListener('pointerdown', handlePointerDown)
        grid?.addEventListener('pointerup', handlePointerUp)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            grid?.removeEventListener('pointerdown', handlePointerDown)
            grid?.removeEventListener('pointerup', handlePointerUp)
        }
    }, [gridRef])

    return { tiles, renderCounter, scoreDeltas, bestScore, gameStatus, resetGame, continueGame, setUpTestWin, setUpTestGameOver, setUpTestTiles }
}

// ============================================
// VIEW - React Components & Rendering
// ============================================

// View-only types
type TileStyle = React.CSSProperties & {
    '--offset-x': string
    '--offset-y': string
}

type DebugInfo = {
    label: string
    bgColor: string
}

type TileRenderProps = {
    from: Position
    to: Position
    value: number
    animClass: string
    debug?: DebugInfo
    key?: string
}

type OverlayButton = { label: string; onClick: () => void }

// Theme utilities
function getTileColor(value: number): string {
    const colors: Record<number, string> = {
        2: '#3c3c3c',
        4: '#4a4a4a',
        8: '#8b7bd8',
        16: '#7bb3d9',
        32: '#7bd9c4',
        64: '#a8d97b',
        128: '#d9c77b',
        256: '#d99a7b',
        512: '#d97bb3',
        1024: '#b37bd9',
        2048: '#7b8bd9',
        4096: '#d97b8b',
    }
    return colors[value] || '#000000'
}

function getTileTextColor(value: number): string {
    if (value <= 4) return '#e0e0e0'
    if (value <= 512) return '#2a2a2a'
    if (value <= 2048) return '#e0e0e0'
    return '#000000'
}

// Helper to suppress unused parameter warnings
function makeUnusedParmaUsed<T>(x: T): T {
    return x
}

// Tile rendering
function renderTile({
    from,
    to,
    value,
    animClass,
    debug,
    key,
}: TileRenderProps) {
    makeUnusedParmaUsed(debug)
    const offsetX = (from.col - to.col) * 100
    const offsetY = (from.row - to.row) * 100
    const style: TileStyle = {
        gridColumn: to.col + 1,
        gridRow: to.row + 1,
        width: '100%',
        height: '100%',
        padding: '5px',
        boxSizing: 'border-box',
        minWidth: 0,
        minHeight: 0,
        '--offset-x': `${String(offsetX)}%`,
        '--offset-y': `${String(offsetY)}%`,
    }

    return (
        <div key={key} className={animClass} style={style}>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: getTileColor(value),
                    color: getTileTextColor(value),
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'safe center',
                    fontSize: value >= 10000 ? '20px' : value >= 1000 ? '28px' : value >= 100 ? '40px' : '55px',
                    fontWeight: 'bold',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '0 5px',
                }}
            >
                <span
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        textAlign: 'center',
                    }}
                >
                    {value}
                </span>
            </div>
        </div>
    )
}

function renderTiles(tiles: Tiles) {
    return tiles.map((tile, index) => {
        switch (tile.state.type) {
            case 'merged':
                return renderMergedTile(tile, tile.state, index)
            case 'moved':
                return renderMovedTile(tile, tile.state, index)
            case 'spawned':
                return renderSpawnedTile(tile, tile.state, index)
            case 'static':
                return renderStaticTile(tile, tile.state, index)
        }
    })
}

function renderMergedTile(tile: Tile, state: MergedState, index: number) {
    return (
        <div key={String(index)} style={{ display: 'contents' }}>
            {renderTile({
                from: state.from1,
                to: tile.position,
                value: state.value,
                animClass: 'tile-merge-source-anim',
                debug: { label: 'merged', bgColor: '#C2185B' },
            })}
            {renderTile({
                from: state.from2,
                to: tile.position,
                value: state.value,
                animClass: 'tile-merge-source-anim',
                debug: { label: 'merged', bgColor: '#C2185B' },
            })}
            {renderTile({
                from: tile.position,
                to: tile.position,
                value: tile.value,
                animClass: 'tile-merge-result-anim',
                debug: { label: 'merged', bgColor: '#C2185B' },
            })}
        </div>
    )
}

function renderMovedTile(tile: Tile, state: MovedState, index: number) {
    return renderTile({
        from: state.from,
        to: tile.position,
        value: tile.value,
        animClass: 'tile-move-anim',
        debug: { label: 'moved', bgColor: '#00897B' },
        key: String(index),
    })
}

function renderSpawnedTile(tile: Tile, _state: SpawnedState, index: number) {
    return renderTile({
        from: tile.position,
        to: tile.position,
        value: tile.value,
        animClass: 'tile-spawn-anim',
        debug: { label: 'spawned', bgColor: '#7B1FA2' },
        key: String(index),
    })
}

function renderStaticTile(tile: Tile, _state: StaticState, index: number) {
    return renderTile({
        from: tile.position,
        to: tile.position,
        value: tile.value,
        animClass: '',
        debug: { label: 'static', bgColor: '#546E7A' },
        key: String(index),
    })
}

// Components
function GameOverlay({
    title,
    buttons,
}: {
    title: string
    buttons: OverlayButton[]
}) {
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '8px',
            }}
        >
            <div style={{
                backgroundColor: '#2d2d2d',
                padding: '30px 40px',
                borderRadius: '12px',
                border: '2px solid #555',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <h2 style={{
                    color: '#fff',
                    fontSize: '36px',
                    marginBottom: '20px',
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                }}>
                    {title}
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                {buttons.map((button) => (
                    <button
                        key={button.label}
                        onClick={button.onClick}
                        style={{
                            padding: '10px 20px',
                            fontSize: '18px',
                            backgroundColor: '#8f7a66',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        {button.label}
                    </button>
                ))}
                </div>
            </div>
        </div>
    )
}

export function TileSlideDemo3() {
    const gridRef = useRef<HTMLDivElement>(null)
    const { tiles, renderCounter, scoreDeltas, bestScore, gameStatus, resetGame, continueGame, setUpTestWin, setUpTestGameOver, setUpTestTiles } =
        useTileSlide(gridRef)
    const score = sumScoreDeltas(scoreDeltas)

    return (
        <div className="min-h-screen bg-neutral-900 select-none flex flex-col justify-center py-8 gap-5 items-center">
                <div
                    className="flex justify-between items-center"
                    style={{ width: `${String(CONFIG.tileSizePx * CONFIG.gridSize)}px` }}
                >
                <div className="flex gap-3">
                    <div className="flex flex-col items-center bg-neutral-700 rounded px-4 py-2">
                        <div className="text-neutral-400 text-sm uppercase">Score</div>
                        <div className="grid">
                            <div className="text-white text-2xl font-bold" style={{ gridArea: '1 / 1' }}>{score}</div>
                            {scoreDeltas.map((delta, index) => (
                                <div
                                    key={index}
                                    className="score-pop-anim text-green-400 text-lg"
                                    style={{ gridArea: '1 / 1' }}
                                >
                                    +{delta}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col items-center bg-neutral-700 rounded px-4 py-2">
                        <div className="text-neutral-400 text-sm uppercase">Best</div>
                        <div className="text-white text-2xl font-bold">{bestScore}</div>
                    </div>
                </div>
                <button
                    onClick={resetGame}
                    className="py-2 px-4 text-base bg-amber-700 text-white rounded cursor-pointer"
                >
                    New Game
                </button>
            </div>

            <div ref={gridRef} className="relative touch-none">
                <div
                    key={renderCounter}
                    className="grid bg-neutral-800 rounded-lg aspect-square"
                    style={{
                        gridTemplateColumns: `repeat(${String(CONFIG.gridSize)}, 1fr)`,
                        gridTemplateRows: `repeat(${String(CONFIG.gridSize)}, 1fr)`,
                        width: `${String(CONFIG.tileSizePx * CONFIG.gridSize)}px`,
                    }}
                >
                    {ALL_POSITIONS.map((pos) => (
                        <div
                            key={`empty-${String(pos.row)}-${String(pos.col)}`}
                            style={{
                                gridRow: pos.row + 1,
                                gridColumn: pos.col + 1,
                                width: '100%',
                                height: '100%',
                                padding: '5px',
                                boxSizing: 'border-box',
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: '#3d3d3d',
                                    borderRadius: '4px',
                                }}
                            />
                        </div>
                    ))}
                    {renderTiles(tiles)}
                </div>
                {gameStatus === 'won' && (
                    <GameOverlay
                        title="You Won!"
                        buttons={[
                            { label: 'Continue', onClick: continueGame },
                            { label: 'New Game', onClick: resetGame },
                        ]}
                    />
                )}
                {gameStatus === 'over' && (
                    <GameOverlay
                        title="Game Over"
                        buttons={[{ label: 'New Game', onClick: resetGame }]}
                    />
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={setUpTestWin}
                    className="py-2 px-4 text-sm bg-neutral-600 text-white rounded cursor-pointer"
                >
                    Test Win
                </button>
                <button
                    onClick={setUpTestGameOver}
                    className="py-2 px-4 text-sm bg-neutral-600 text-white rounded cursor-pointer"
                >
                    Test Game Over
                </button>
                <button
                    onClick={setUpTestTiles}
                    className="py-2 px-4 text-sm bg-neutral-600 text-white rounded cursor-pointer"
                >
                    Test Tiles
                </button>
            </div>
        </div>
    )
}
