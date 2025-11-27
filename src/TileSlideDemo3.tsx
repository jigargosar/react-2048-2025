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
    INITIAL_MODEL,
    type MergedState,
    type Model,
    type MovedState,
    type Position,
    prepareMove,
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
        setModel((m) => continueGameModel(m))
    }

    const setUpTestWin = () => {
        setModel((m) => createTestWinModel(m))
    }

    const setUpTestGameOver = () => {
        setModel((m) => createTestGameOverModel(m))
    }

    const setUpTestTiles = () => {
        setModel((m) => createAllTestTilesModel(m))
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
        '--offset-x': `${String(offsetX)}%`,
        '--offset-y': `${String(offsetY)}%`,
    }

    return (
        <div key={key} className={`${animClass} w-full h-full p-1 box-border min-w-0 min-h-0`} style={style}>
            <div
                className="w-full h-full rounded flex items-center relative overflow-hidden font-bold px-1 justify-[safe_center]"
                style={{
                    backgroundColor: getTileColor(value),
                    color: getTileTextColor(value),
                    fontSize:
                        value >= 10000
                            ? '20px'
                            : value >= 1000
                              ? '28px'
                              : value >= 100
                                ? '40px'
                                : '55px',
                }}
            >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap w-full text-center">
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

// Components
function GameOverlay({
    title,
    buttons,
}: {
    title: string
    buttons: OverlayButton[]
}) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/80">
            <div className="flex flex-col items-center rounded-xl border-2 py-8 px-10 bg-neutral-800 border-neutral-600">
                <h2 className="text-white mb-5 text-4xl">
                    {title}
                </h2>
                <div className="flex gap-2.5">
                    {buttons.map((button) => (
                        <button
                            key={button.label}
                            onClick={button.onClick}
                            className="text-white border-none rounded cursor-pointer py-2.5 px-5 text-lg bg-stone-600"
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

    return (
        <div className="min-h-screen bg-neutral-900 select-none flex flex-col justify-center py-8 gap-5 items-center">
            <div
                className="flex justify-between items-center"
                style={{
                    width: `${String(CONFIG.tileSizePx * CONFIG.gridSize)}px`,
                }}
            >
                <div className="flex gap-3">
                    <div className="flex flex-col items-center bg-neutral-700 rounded px-4 py-2">
                        <div className="text-neutral-400 text-sm uppercase">
                            Score
                        </div>
                        <div className="grid">
                            <div
                                className="text-white text-2xl font-bold"
                                style={{ gridArea: '1 / 1' }}
                            >
                                {score}
                            </div>
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
                        <div className="text-neutral-400 text-sm uppercase">
                            Best
                        </div>
                        <div className="text-white text-2xl font-bold">
                            {bestScore}
                        </div>
                    </div>
                </div>
                <button
                    onClick={resetGame}
                    className="py-2 px-4 text-base bg-amber-900 text-white rounded cursor-pointer"
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
                            className="w-full h-full p-1 box-border"
                            style={{
                                gridRow: pos.row + 1,
                                gridColumn: pos.col + 1,
                            }}
                        >
                            <div className="w-full h-full rounded bg-neutral-700" />
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
