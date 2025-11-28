import type React from 'react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { inc } from 'ramda'
import { createSeededRandom } from './utils.ts'
import {
    ALL_POSITIONS,
    applyMove,
    CONFIG,
    continueGameModel,
    createAllTestTilesModel,
    createTestGameOverModel,
    createTestWinModel,
    type Direction,
    type GameStatus,
    INITIAL_MODEL,
    type MergedState,
    type Model,
    type MovedState,
    type Position,
    prepareMove,
    type ScoreDeltas,
    type SpawnedState,
    type StaticState,
    sumScoreDeltas,
    type Tile,
    type Tiles,
} from './model.ts'

// ============================================
// HOOK - State Management & Coordination
// ============================================

// Hook-only constants
const INITIAL_RENDER_COUNTER = 0
const INITIAL_RANDOM_SEED = 1

// LocalStorage utilities
function loadBestScore(): number {
    const stored = localStorage.getItem(CONFIG.localStorageBestScoreKey)
    return stored ? Number(stored) : 0
}

function saveBestScore(score: number): void {
    localStorage.setItem(CONFIG.localStorageBestScoreKey, String(score))
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

function parseDirectionFromSwipe(
    deltaX: number,
    deltaY: number,
): Direction | null {
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (
        absX < CONFIG.minSwipeDetectDistancePx &&
        absY < CONFIG.minSwipeDetectDistancePx
    )
        return null

    if (absX > absY) {
        return deltaX > 0 ? 'right' : 'left'
    } else {
        return deltaY > 0 ? 'down' : 'up'
    }
}

// Main hook
function useTileSlide(gridRef: React.RefObject<HTMLDivElement | null>) {
    const [model, setModel] = useState<Model>({
        ...INITIAL_MODEL,
        bestScore: loadBestScore(),
    })
    const [renderCounter, setRenderCounter] = useState(INITIAL_RENDER_COUNTER)
    const randomRef = useRef(createSeededRandom(INITIAL_RANDOM_SEED))

    const resetGame = () => {
        setModel({
            ...INITIAL_MODEL,
            bestScore: loadBestScore(),
        })
        setRenderCounter(INITIAL_RENDER_COUNTER)
        randomRef.current = createSeededRandom(INITIAL_RANDOM_SEED)
    }

    const continueGame = () => {
        setModel(continueGameModel)
    }

    const setUpTestWin = () => {
        setModel(createTestWinModel)
    }

    const setUpTestGameOver = () => {
        setModel(createTestGameOverModel)
    }

    const setUpTestTiles = () => {
        setModel(createAllTestTilesModel)
    }

    const onMove = useEffectEvent((direction: Direction) => {
        const prepared = prepareMove(model)

        if (!prepared) return

        setModel(prepared)
        setRenderCounter(inc)
        requestAnimationFrame(() => {
            setModel((m) => {
                const result = applyMove(m, direction, randomRef.current)
                return result ?? m
            })
        })
    })

    // Side effect: persist bestScore to localStorage
    useEffect(() => {
        saveBestScore(model.bestScore)
    }, [model.bestScore])

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

    return {
        tiles: model.tiles,
        scoreDeltas: model.scoreDeltas,
        bestScore: model.bestScore,
        gameStatus: model.gameStatus,
        renderCounter,
        resetGame,
        continueGame,
        setUpTestWin,
        setUpTestGameOver,
        setUpTestTiles,
    }
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
        2: '#4a4a5a',
        4: '#5a5a4a',
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

function getTileFontSize(value: number): string {
    if (value >= 10000) return '20px'
    if (value >= 1000) return '28px'
    if (value >= 100) return '40px'
    return '55px'
}

// Helper to suppress unused parameter warnings
function makeUnusedParmaUsed<T>(x: T): T {
    return x
}

// View utilities
function cn(...classes: string[]) {
    return classes.join(' ')
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
        '--offset-x': `${String(offsetX)}%`,
        '--offset-y': `${String(offsetY)}%`,
    }

    return (
        <div
            key={key}
            className={cn(
                animClass,
                'w-full h-full min-w-0 min-h-0 box-border',
                'p-1',
            )}
            style={style}
        >
            <div
                className={cn(
                    'w-full h-full rounded',
                    'flex items-center justify-[safe_center]',
                    'relative overflow-hidden',
                    'font-bold',
                    'px-1',
                )}
                style={{
                    backgroundColor: getTileColor(value),
                    color: getTileTextColor(value),
                    fontSize: getTileFontSize(value),
                }}
            >
                <span
                    className={cn(
                        'w-full',
                        'overflow-hidden text-ellipsis whitespace-nowrap',
                        'text-center',
                    )}
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
        <div key={String(index)} className="contents">
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

// Render functions - sections
function renderHeader(
    score: number,
    scoreDeltas: ScoreDeltas,
    bestScore: number,
    resetGame: () => void,
) {
    return (
        <div className="flex justify-between items-center">
            <div className="flex gap-3">
                {renderScore('Score', score, scoreDeltas)}
                {renderBestScore('Best', bestScore)}
            </div>
            {renderButton('New Game', resetGame, true)}
        </div>
    )
}

function renderGameBoard(
    renderCounter: number,
    tiles: Tiles,
    gameStatus: GameStatus,
    continueGame: () => void,
    resetGame: () => void,
    gridRef: React.RefObject<HTMLDivElement | null>,
) {
    const gridStyleValue = `repeat(${String(CONFIG.gridSize)}, 1fr) / repeat(${String(CONFIG.gridSize)}, 1fr)`
    return (
        <div ref={gridRef} className="relative touch-none">
            <div
                key={renderCounter}
                className="grid bg-neutral-800 rounded-lg aspect-square"
                style={{ grid: gridStyleValue }}
            >
                {ALL_POSITIONS.map(renderEmptyCell)}
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
    )
}

function renderFooter(
    setUpTestWin: () => void,
    setUpTestGameOver: () => void,
    setUpTestTiles: () => void,
) {
    return (
        <div className="flex gap-2">
            {renderButton('Test Win', setUpTestWin)}
            {renderButton('Test Game Over', setUpTestGameOver)}
            {renderButton('Test Tiles', setUpTestTiles)}
        </div>
    )
}

// Render functions - tiny building blocks
function renderScore(label: string, value: number, deltas: ScoreDeltas) {
    return (
        <div
            className={cn(
                'flex flex-col items-center',
                'bg-neutral-700 rounded',
                'px-4 py-2',
            )}
        >
            <div className="text-neutral-400 text-sm uppercase">{label}</div>
            <div className="grid">
                <div
                    className={cn(
                        'text-white text-2xl font-bold',
                        '[grid-area:1/1]',
                    )}
                >
                    {value}
                </div>
                {deltas.map((delta, index) => (
                    <div
                        key={index}
                        className={cn(
                            'score-pop-anim',
                            'text-green-400 text-lg',
                            '[grid-area:1/1]',
                        )}
                    >
                        +{delta}
                    </div>
                ))}
            </div>
        </div>
    )
}

function renderBestScore(label: string, value: number) {
    return (
        <div
            className={cn(
                'flex flex-col items-center',
                'bg-neutral-700 rounded',
                'px-4 py-2',
            )}
        >
            <div className="text-neutral-400 text-sm uppercase">{label}</div>
            <div className="text-white text-2xl font-bold">{value}</div>
        </div>
    )
}

function renderEmptyCell(pos: Position) {
    return (
        <div
            key={`empty-${String(pos.row)}-${String(pos.col)}`}
            className="w-full h-full p-1 box-border"
            style={{
                gridRow: pos.row + 1,
                gridColumn: pos.col + 1,
            }}
        >
            <div className="w-full h-full rounded bg-neutral-700" />
        </div>
    )
}

function renderButton(label: string, onClick: () => void, primary = false) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'text-white text-base rounded cursor-pointer',
                'py-2 px-4',
                primary ? 'bg-amber-900' : 'bg-stone-600',
            )}
        >
            {label}
        </button>
    )
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
            className={cn(
                'absolute inset-0',
                'flex flex-col items-center justify-center',
                'rounded-lg',
                'bg-black/80',
            )}
        >
            <div
                className={cn(
                    'flex flex-col items-center',
                    'rounded-xl border-2 border-neutral-600',
                    'bg-neutral-800',
                    'py-8 px-10',
                )}
            >
                <h2 className={cn('text-white text-4xl', 'mb-5')}>{title}</h2>
                <div className="flex gap-2.5">
                    {buttons.map((button) =>
                        renderButton(button.label, button.onClick),
                    )}
                </div>
            </div>
        </div>
    )
}

export function App() {
    const gridRef = useRef<HTMLDivElement>(null)
    const {
        tiles,
        renderCounter,
        scoreDeltas,
        bestScore,
        gameStatus,
        resetGame,
        continueGame,
        setUpTestWin,
        setUpTestGameOver,
        setUpTestTiles,
    } = useTileSlide(gridRef)
    const score = sumScoreDeltas(scoreDeltas)

    const boardWidth = CONFIG.tileSizePx * CONFIG.gridSize
    return (
        <div
            className={cn(
                'min-h-screen bg-neutral-900 select-none',
                'flex flex-col justify-center items-center',
                'py-8',
            )}
        >
            <div
                className="flex flex-col gap-5"
                style={{ width: `${String(boardWidth)}px` }}
            >
                {renderHeader(score, scoreDeltas, bestScore, resetGame)}
                {renderGameBoard(
                    renderCounter,
                    tiles,
                    gameStatus,
                    continueGame,
                    resetGame,
                    gridRef,
                )}
                {renderFooter(setUpTestWin, setUpTestGameOver, setUpTestTiles)}
            </div>
        </div>
    )
}
