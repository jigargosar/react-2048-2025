import { useState } from 'react'
import { pipe } from 'fp-ts/function'
import * as A from 'fp-ts/Array'
import { type Matrix, transpose, reverseRows } from './utils'

type Tile = {
    id: number
    value: number
    row: number
    col: number
    visualRow: number
    visualCol: number
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
    return grid.map((row) => {
        const tiles = row.filter((cell) => cell !== null)
        const nulls = Array(row.length - tiles.length).fill(null)
        return tiles.concat(nulls)
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

const initialTiles: Tile[] = [
    { id: 1, value: 2, row: 0, col: 1, visualRow: 0, visualCol: 1 },
    { id: 2, value: 4, row: 0, col: 3, visualRow: 0, visualCol: 3 },
    { id: 3, value: 8, row: 1, col: 2, visualRow: 1, visualCol: 2 },
    { id: 4, value: 16, row: 2, col: 0, visualRow: 2, visualCol: 0 },
    { id: 5, value: 32, row: 2, col: 3, visualRow: 2, visualCol: 3 },
    { id: 6, value: 64, row: 3, col: 1, visualRow: 3, visualCol: 1 },
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
                return slideWithGrid(normalized, direction)
            })
            setRenderKey((k) => k + 1)

            requestAnimationFrame(() => {
                setTiles((tiles) =>
                    tiles.map((tile) => ({
                        ...tile,
                        visualRow: tile.row,
                        visualCol: tile.col,
                    })),
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
                {tiles.map((tile) => {
                    const offsetCols = tile.visualCol - tile.col
                    const offsetRows = tile.visualRow - tile.row
                    return (
                        <div
                            key={tile.id}
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
                        </div>
                    )
                })}
            </div>

            <p style={{ marginTop: '20px', color: '#ccc' }}>
                Press Arrow keys to slide
            </p>
        </div>
    )
}
