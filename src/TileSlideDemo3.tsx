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

// Types
type Position = Readonly<{ row: number; col: number }>
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
type MaybeTile = Tile | null
type Tiles = readonly Tile[]
type Positions = readonly Position[]
type Direction = 'left' | 'right' | 'up' | 'down'
type MaybeTiles = readonly MaybeTile[]
type MatrixMaybeTile = Matrix<MaybeTile>
type ScoreDeltas = readonly number[]
type Random = () => number
type GameStatus = 'playing' | 'won' | 'continue' | 'over'

const TILES_TO_SPAWN = 1
const GRID_SIZE = 5
const TILE_SIZE = 100

const POSITION_MATRIX: Matrix<Position> = times(
    (row) => times((col) => ({ row, col }), GRID_SIZE),
    GRID_SIZE,
)
const ALL_POSITIONS: Positions = POSITION_MATRIX.flat()

type InitialState = {
    tiles: Tiles
    scoreDeltas: ScoreDeltas
    renderCounter: number
    randomSeed: number
    gameStatus: GameStatus
}

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

function getEmptyPositions(tiles: Tiles): Positions {
    const matrix = tilesToMatrix(tiles)
    return ALL_POSITIONS.filter((p) => matrix[p.row]?.[p.col] === null)
}

function createSpawnedTile(position: Position, value: number): Tile {
    return { value, position, state: { type: 'spawned' } }
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

function tilesToMatrix(tiles: Tiles): MatrixMaybeTile {
    // Not using MatrixMaybeTile - needs mutable array during construction
    const matrix: MaybeTile[][] = times(() => repeat(null, GRID_SIZE), GRID_SIZE)
    for (const tile of tiles) {
        const row = matrix[tile.position.row]
        if (row) {
            row[tile.position.col] = tile
        }
    }

    return matrix
}

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

// Update tile positions based on their location in the matrix
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

// Slide and merge a single row of tiles left
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
    const result: MaybeTile[] = repeat(null, GRID_SIZE)
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

// Slide tiles left in matrix
function slideLeft(matrix: MatrixMaybeTile): MatrixMaybeTile {
    return matrix.map(slideAndMergeRowLeft)
}

// Slide tiles in the specified direction
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

// Process tiles for sliding in a direction
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

function computeScoreDelta(tiles: Tiles): number {
    return tiles
        .filter((t) => t.state.type === 'merged')
        .reduce((sum, t) => sum + t.value, 0)
}

const WIN_VALUE = 2048

function hasWon(tiles: Tiles): boolean {
    return tiles.some((t) => t.value >= WIN_VALUE)
}

function canMove(tiles: Tiles): boolean {
    // Has empty cell
    if (tiles.length < GRID_SIZE * GRID_SIZE) return true

    // Has adjacent matching tiles
    const matrix = tilesToMatrix(tiles)
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
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

type MoveResult = { tiles: Tiles; scoreDelta: number }

function move(tiles: Tiles, direction: Direction, random: Random): MoveResult {
    const movedTiles = slideAndMergeTiles(tiles, direction)
    const allStatic = movedTiles.every((t) => t.state.type === 'static')
    if (allStatic) return { tiles, scoreDelta: 0 }

    const scoreDelta = computeScoreDelta(movedTiles)
    return {
        tiles: spawnRandomTiles(movedTiles, TILES_TO_SPAWN, random),
        scoreDelta,
    }
}

// VIEW

function useTileSlide() {
    const [tiles, setTiles] = useState<Tiles>(INITIAL_STATE.tiles)
    const [renderCounter, setRenderCounter] = useState(INITIAL_STATE.renderCounter)
    const [scoreDeltas, setScoreDeltas] = useState<ScoreDeltas>(INITIAL_STATE.scoreDeltas)
    const [gameStatus, setGameStatus] = useState<GameStatus>(INITIAL_STATE.gameStatus)
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
        const tiles: Tiles = ALL_POSITIONS.map((position, index) => ({
            value: index % 2 === 0 ? 2 : 4,
            position,
            state: { type: 'static' } as const,
        }))
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
            const result = move(staticTiles, direction, randomRef.current)
            setTiles(result.tiles)
            if (result.scoreDelta > 0) {
                setScoreDeltas((deltas) => [...deltas, result.scoreDelta])
            }

            // Check game status after move
            if (gameStatus === 'playing' && hasWon(result.tiles)) {
                setGameStatus('won')
            } else if (isGameOver(result.tiles)) {
                setGameStatus('over')
            }
        })
    })

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const direction = parseDirectionFromKey(event.key)
            if (direction) onMove(direction)
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [])

    return { tiles, renderCounter, scoreDeltas, gameStatus, resetGame, continueGame, setUpTestWin, setUpTestGameOver }
}

export function TileSlideDemo3() {
    const { tiles, renderCounter, scoreDeltas, gameStatus, resetGame, continueGame, setUpTestWin, setUpTestGameOver } =
        useTileSlide()
    const score = scoreDeltas.reduce((a, b) => a + b, 0)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#1a1a1a',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: `${String(TILE_SIZE * GRID_SIZE)}px`,
                    marginBottom: '20px',
                }}
            >
                <div style={{ position: 'relative' }}>
                    <span style={{ color: '#fff', fontSize: '24px' }}>
                        Score: {score}
                    </span>
                    {scoreDeltas.map((delta, index) => (
                        <span
                            key={index}
                            className="score-pop-anim"
                            style={{
                                position: 'absolute',
                                right: '-50px',
                                top: '0',
                                color: '#6f6',
                                fontSize: '18px',
                            }}
                        >
                            +{delta}
                        </span>
                    ))}
                </div>
                <button
                    onClick={resetGame}
                    style={{
                        padding: '8px 16px',
                        fontSize: '16px',
                        backgroundColor: '#8f7a66',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    New Game
                </button>
            </div>

            <div style={{ position: 'relative' }}>
                <div
                    key={renderCounter}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${String(GRID_SIZE)}, 1fr)`,
                        gridTemplateRows: `repeat(${String(GRID_SIZE)}, 1fr)`,
                        gap: '0',
                        background: '#2d2d2d',
                        borderRadius: '8px',
                        width: `${String(TILE_SIZE * GRID_SIZE)}px`,
                        aspectRatio: '1/1',
                    }}
                >
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                    onClick={setUpTestWin}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#5a5a5a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Test Win
                </button>
                <button
                    onClick={setUpTestGameOver}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        backgroundColor: '#5a5a5a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Test Game Over
                </button>
            </div>
        </div>
    )
}

type OverlayButton = { label: string; onClick: () => void }

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
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '8px',
            }}
        >
            <h2 style={{ color: '#fff', fontSize: '36px', marginBottom: '20px' }}>
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
    )
}

function getTileColor(value: number): string {
    const colors: Record<number, string> = {
        2: '#eee4da',
        4: '#ede0c8',
        8: '#f2b179',
        16: '#f59563',
        32: '#f67c5f',
        64: '#f65e3b',
        128: '#edcf72',
        256: '#edcc61',
        512: '#edc850',
        1024: '#edc53f',
        2048: '#edc22e',
    }
    return colors[value] || '#cdc1b4'
}

function getTileTextColor(value: number): string {
    return value <= 4 ? '#776e65' : '#f9f6f2'
}

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

function renderTile({
    from,
    to,
    value,
    animClass,
    debug,
    key,
}: TileRenderProps) {
    const offsetX = (from.col - to.col) * 100
    const offsetY = (from.row - to.row) * 100

    const style: TileStyle = {
        gridColumn: to.col + 1,
        gridRow: to.row + 1,
        width: '100%',
        height: '100%',
        padding: '5px',
        boxSizing: 'border-box',
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
                    justifyContent: 'center',
                    fontSize: value >= 1000 ? '35px' : '55px',
                    fontWeight: 'bold',
                    position: 'relative',
                    outline: debug ? `1.5px solid ${debug.bgColor}` : undefined,
                }}
            >
                {value}
                {debug && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '0',
                            right: '0',
                            fontSize: '9px',
                            color: '#fff',
                            backgroundColor: debug.bgColor,
                            padding: '1px 4px',
                            borderRadius: '0 4px 0 4px',
                            fontWeight: 'normal',
                        }}
                    >
                        {debug.label}
                    </span>
                )}
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
