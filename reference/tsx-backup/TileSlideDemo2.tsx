import { useState } from 'react'
import { pipe } from 'fp-ts/function'
import * as A from 'fp-ts/Array'
import { type Matrix, transpose, reverseRows } from '../../src/utils'

type SourceTile = {
    row: number
    col: number
    visualRow: number
    visualCol: number
}

type Tile = {
    value: number
    row: number
    col: number
    visualRow: number
    visualCol: number
    mergeState:
        | { type: 'normal' }
        | {
              type: 'merged'
              source1: SourceTile
              source2: SourceTile
              sourceValue: number
          }
}

type Direction = 'left' | 'right' | 'up' | 'down'

const GRID_SIZE = 4

type Grid = Matrix<Tile | null>

const EMPTY_GRID: Grid = A.replicate(GRID_SIZE, A.replicate(GRID_SIZE, null))

function tilesToGrid(tiles: Tile[]): Grid {
    return tiles.reduce((grid, tile) => {
        const row = grid[tile.row] ?? []
        const updatedRow = row.with(tile.col, tile)
        return grid.with(tile.row, updatedRow)
    }, EMPTY_GRID)
}

function slideLeftGrid(grid: Grid): Grid {
    return grid.map((row, rowIndex) => {
        const tiles = row.filter((cell) => cell !== null)
        const result: (Tile | null)[] = []

        let i = 0
        while (i < tiles.length) {
            const current = tiles[i]
            const next = tiles[i + 1]

            if (current && next && current.value === next.value) {
                const mergedTile: Tile = {
                    value: current.value * 2,
                    row: rowIndex,
                    col: result.length,
                    visualRow: rowIndex,
                    visualCol: result.length,
                    mergeState: {
                        type: 'merged',
                        source1: {
                            row: current.row,
                            col: current.col,
                            visualRow: current.visualRow,
                            visualCol: current.visualCol,
                        },
                        source2: {
                            row: next.row,
                            col: next.col,
                            visualRow: next.visualRow,
                            visualCol: next.visualCol,
                        },
                        sourceValue: current.value,
                    },
                }
                result.push(mergedTile)
                i += 2
            } else if (current) {
                result.push({ ...current, mergeState: { type: 'normal' } })
                i += 1
            } else {
                i += 1
            }
        }

        const nulls = Array(row.length - result.length).fill(null)
        return result.concat(nulls)
    })
}

function slideGridInDirection(grid: Grid, direction: Direction): Grid {
    switch (direction) {
        case 'left':
            return pipe(grid, slideLeftGrid)
        case 'right':
            return pipe(grid, reverseRows, slideLeftGrid, reverseRows)
        case 'up':
            return pipe(grid, transpose, slideLeftGrid, transpose)
        case 'down':
            return pipe(
                grid,
                transpose,
                reverseRows,
                slideLeftGrid,
                reverseRows,
                transpose,
            )
        default:
            return grid
    }
}

function gridToTiles(grid: Grid): Tile[] {
    return grid.flatMap((row, rowIndex) =>
        row.flatMap((tile, colIndex) =>
            tile ? [{ ...tile, row: rowIndex, col: colIndex }] : [],
        ),
    )
}

function slideWithGrid(tiles: Tile[], direction: Direction): Tile[] {
    return pipe(
        tiles,
        tilesToGrid,
        (grid) => slideGridInDirection(grid, direction),
        gridToTiles,
    )
}

function findEmptyCells(tiles: Tile[]): Array<{ row: number; col: number }> {
    const occupied = new Set(tiles.map((tile) => `${String(tile.row)},${String(tile.col)}`))
    const empty: Array<{ row: number; col: number }> = []

    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if (!occupied.has(`${String(row)},${String(col)}`)) {
                empty.push({ row, col })
            }
        }
    }

    return empty
}

function spawnRandomTile(tiles: Tile[]): Tile | null {
    const emptyCells = findEmptyCells(tiles)
    if (emptyCells.length === 0) return null

    const randomIndex = Math.floor(Math.random() * emptyCells.length)
    const position = emptyCells[randomIndex]
    const value = Math.random() < 0.9 ? 2 : 4

    if (!position) return null

    return {
        value,
        row: position.row,
        col: position.col,
        visualRow: position.row,
        visualCol: position.col,
        mergeState: { type: 'normal' },
    }
}

const initialTiles: Tile[] = [
    { value: 2, row: 0, col: 0, visualRow: 0, visualCol: 0, mergeState: { type: 'normal' } },
    { value: 2, row: 0, col: 1, visualRow: 0, visualCol: 1, mergeState: { type: 'normal' } },
    { value: 4, row: 0, col: 2, visualRow: 0, visualCol: 2, mergeState: { type: 'normal' } },
    { value: 4, row: 0, col: 3, visualRow: 0, visualCol: 3, mergeState: { type: 'normal' } },
    { value: 2, row: 1, col: 0, visualRow: 1, visualCol: 0, mergeState: { type: 'normal' } },
    { value: 2, row: 1, col: 2, visualRow: 1, visualCol: 2, mergeState: { type: 'normal' } },
]

function useTileSlide() {
    const [tiles, setTiles] = useState<Tile[]>(initialTiles)
    const [renderKey, setRenderKey] = useState(0)

    const handleKeyDown = (e: KeyboardEvent) => {
        let direction: Direction | null = null

        if (e.key === 'ArrowLeft') {
            direction = 'left'
        } else if (e.key === 'ArrowRight') {
            direction = 'right'
        } else if (e.key === 'ArrowUp') {
            direction = 'up'
        } else if (e.key === 'ArrowDown') {
            direction = 'down'
        }

        if (direction) {
            setTiles((tiles) => {
                const normalized = tiles.map((tile) => ({
                    ...tile,
                    row: tile.visualRow,
                    col: tile.visualCol,
                }))
                const afterSlide = slideWithGrid(normalized, direction)
                const newTile = spawnRandomTile(afterSlide)

                return newTile ? [...afterSlide, newTile] : afterSlide
            })
            setRenderKey((k) => k + 1)

            requestAnimationFrame(() => {
                setTiles((tiles) =>
                    tiles.map((tile) => {
                        if (tile.mergeState.type === 'normal') {
                            return {
                                ...tile,
                                visualRow: tile.row,
                                visualCol: tile.col,
                            }
                        } else {
                            return {
                                ...tile,
                                visualRow: tile.row,
                                visualCol: tile.col,
                                mergeState: {
                                    ...tile.mergeState,
                                    source1: {
                                        ...tile.mergeState.source1,
                                        visualRow: tile.row,
                                        visualCol: tile.col,
                                    },
                                    source2: {
                                        ...tile.mergeState.source2,
                                        visualRow: tile.row,
                                        visualCol: tile.col,
                                    },
                                },
                            }
                        }
                    }),
                )
            })
        }
    }

    useState(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    })

    return { tiles, renderKey }
}

export default function TileSlideDemo2() {
    const { tiles, renderKey } = useTileSlide()

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
            <h1 style={{ marginBottom: '20px', color: '#fff' }}>
                Slide Left Test
            </h1>

            <div
                key={renderKey}
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${String(GRID_SIZE)}, 1fr)`,
                    gridTemplateRows: `repeat(${String(GRID_SIZE)}, 1fr)`,
                    gap: '0',
                    background: '#2d2d2d',
                    borderRadius: '8px',
                    width: '400px',
                    height: '400px',
                }}
            >
                {tiles.flatMap((tile, idx) => {
                    if (tile.mergeState.type === 'normal') {
                        const offsetCols = tile.visualCol - tile.col
                        const offsetRows = tile.visualRow - tile.row
                        return [
                            <div
                                key={idx}
                                style={{
                                    gridColumn: tile.col + 1,
                                    gridRow: tile.row + 1,
                                    width: '100%',
                                    height: '100%',
                                    padding: '5px',
                                    boxSizing: 'border-box',
                                    transform: `translate(${String(offsetCols * 100)}%, ${String(offsetRows * 100)}%)`,
                                    transition: 'transform 200ms ease-in-out',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: '#4CAF50',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '32px',
                                        color: '#fff',
                                    }}
                                >
                                    {tile.value}
                                </div>
                            </div>,
                        ]
                    } else {
                        const { source1, source2, sourceValue } = tile.mergeState
                        const source1OffsetCols = source1.visualCol - tile.col
                        const source1OffsetRows = source1.visualRow - tile.row
                        const source2OffsetCols = source2.visualCol - tile.col
                        const source2OffsetRows = source2.visualRow - tile.row

                        return [
                            <div
                                key={`${String(idx)}-source1`}
                                style={{
                                    gridColumn: tile.col + 1,
                                    gridRow: tile.row + 1,
                                    width: '100%',
                                    height: '100%',
                                    padding: '5px',
                                    boxSizing: 'border-box',
                                    transform: `translate(${String(source1OffsetCols * 100)}%, ${String(source1OffsetRows * 100)}%)`,
                                    transition: 'transform 200ms ease-in-out',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: '#4CAF50',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '32px',
                                        color: '#fff',
                                    }}
                                >
                                    {sourceValue}
                                </div>
                            </div>,
                            <div
                                key={`${String(idx)}-source2`}
                                style={{
                                    gridColumn: tile.col + 1,
                                    gridRow: tile.row + 1,
                                    width: '100%',
                                    height: '100%',
                                    padding: '5px',
                                    boxSizing: 'border-box',
                                    transform: `translate(${String(source2OffsetCols * 100)}%, ${String(source2OffsetRows * 100)}%)`,
                                    transition: 'transform 200ms ease-in-out',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: '#4CAF50',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '32px',
                                        color: '#fff',
                                    }}
                                >
                                    {sourceValue}
                                </div>
                            </div>,
                            <div
                                key={idx}
                                style={{
                                    gridColumn: tile.col + 1,
                                    gridRow: tile.row + 1,
                                    width: '100%',
                                    height: '100%',
                                    padding: '5px',
                                    boxSizing: 'border-box',
                                    transform: 'translate(0%, 0%)',
                                    transition: 'transform 200ms ease-in-out, opacity 200ms ease-in-out',
                                    opacity: 0.8,
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: '#FF9800',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '32px',
                                        color: '#fff',
                                    }}
                                >
                                    {tile.value}
                                </div>
                            </div>,
                        ]
                    }
                })}
            </div>

            <p style={{ marginTop: '20px', color: '#ccc' }}>
                Press Arrow keys to slide
            </p>
        </div>
    )
}
