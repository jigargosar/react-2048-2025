import { useState } from 'react'

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

// ============ NEW GRID-BASED SLIDE IMPLEMENTATION ============

type Grid = (Tile | null)[][]

// Utility: Pipe function for composing transformations
function pipe<T>(value: T, ...fns: ((arg: T) => T)[]): T {
    return fns.reduce((acc, fn) => fn(acc), value)
}

// Helper: Transpose 2D array (swap rows and columns)
function transpose<T>(array: T[][]): T[][] {
    if (array.length === 0) return []
    return array[0].map((_, colIndex) => array.map((row) => row[colIndex]))
}

// Helper: Reverse each row (horizontal flip)
function reverseRows<T>(array: T[][]): T[][] {
    return array.map((row) => [...row].reverse())
}

// Convert tiles array to 2D grid
function tilesToGrid(tiles: Tile[]): Grid {
    const grid: Grid = Array.from({ length: GRID_SIZE }, () =>
        Array(GRID_SIZE).fill(null),
    )
    tiles.forEach((tile) => {
        grid[tile.row][tile.col] = tile
    })
    return grid
}

// Slide all rows left (core logic)
function slideLeftGrid(grid: Grid): Grid {
    return grid.map((row) => {
        const tiles = row.filter((cell) => cell !== null)
        const nulls = Array(row.length - tiles.length).fill(null)
        return [...tiles, ...nulls]
    })
}

// Slide with transformations using pipe
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

// Extract tiles from grid with new positions
function gridToTiles(grid: Grid): Tile[] {
    return grid.flatMap((row, rowIndex) =>
        row.flatMap((tile, colIndex) =>
            tile ? [{ ...tile, row: rowIndex, col: colIndex }] : [],
        ),
    )
}

// Main slide function using grid approach
function slideWithGrid(tiles: Tile[], direction: Direction): Tile[] {
    return pipe(
        tiles,
        tilesToGrid,
        (grid) => slideGridInDirection(grid, direction),
        gridToTiles,
    )
}

// ============ END NEW GRID-BASED IMPLEMENTATION ============

function slideLeft(tiles: Tile[]): Tile[] {
    const rows: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

    tiles.forEach((tile) => {
        rows[tile.row].push(tile)
    })

    const newTiles: Tile[] = []
    rows.forEach((rowTiles) => {
        const sorted = rowTiles.sort((a, b) => a.visualCol - b.visualCol)
        sorted.forEach((tile, index) => {
            newTiles.push({
                ...tile,
                col: index,
            })
        })
    })

    return newTiles
}

function slideRight(tiles: Tile[]): Tile[] {
    const rows: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

    tiles.forEach((tile) => {
        rows[tile.row].push(tile)
    })

    const newTiles: Tile[] = []
    rows.forEach((rowTiles) => {
        const sorted = rowTiles.sort((a, b) => b.visualCol - a.visualCol)
        sorted.forEach((tile, index) => {
            const newCol = GRID_SIZE - 1 - index
            newTiles.push({
                ...tile,
                col: newCol,
            })
        })
    })

    return newTiles
}

function slideUp(tiles: Tile[]): Tile[] {
    const cols: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

    tiles.forEach((tile) => {
        cols[tile.col].push(tile)
    })

    const newTiles: Tile[] = []
    cols.forEach((colTiles) => {
        const sorted = colTiles.sort((a, b) => a.visualRow - b.visualRow)
        sorted.forEach((tile, index) => {
            newTiles.push({
                ...tile,
                row: index,
            })
        })
    })

    return newTiles
}

function slideDown(tiles: Tile[]): Tile[] {
    const cols: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

    tiles.forEach((tile) => {
        cols[tile.col].push(tile)
    })

    const newTiles: Tile[] = []
    cols.forEach((colTiles) => {
        const sorted = colTiles.sort((a, b) => b.visualRow - a.visualRow)
        sorted.forEach((tile, index) => {
            const newRow = GRID_SIZE - 1 - index
            newTiles.push({
                ...tile,
                row: newRow,
            })
        })
    })

    return newTiles
}

function slide(tiles: Tile[], direction: Direction): Tile[] {
    switch (direction) {
        case 'left':
            return slideLeft(tiles)
        case 'right':
            return slideRight(tiles)
        case 'up':
            return slideUp(tiles)
        case 'down':
            return slideDown(tiles)
        default:
            return tiles
    }
}

export default function TileSlideDemo2() {
    const [tiles, setTiles] = useState<Tile[]>([
        { id: 1, value: 2, row: 0, col: 1, visualRow: 0, visualCol: 1 },
        { id: 2, value: 4, row: 0, col: 3, visualRow: 0, visualCol: 3 },
        { id: 3, value: 8, row: 1, col: 2, visualRow: 1, visualCol: 2 },
        { id: 4, value: 16, row: 2, col: 0, visualRow: 2, visualCol: 0 },
        { id: 5, value: 32, row: 2, col: 3, visualRow: 2, visualCol: 3 },
        { id: 6, value: 64, row: 3, col: 1, visualRow: 3, visualCol: 1 },
    ])
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
            // Step 1: Normalize positions and calculate new positions, increment key
            setTiles((tiles) => {
                const normalized = tiles.map((tile) => ({
                    ...tile,
                    row: tile.visualRow,
                    col: tile.visualCol,
                }))
                return slideWithGrid(normalized, direction!)
            })
            setRenderKey((k) => k + 1)

            // Step 2: After browser paints, update visual positions for animation
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
        return () => window.removeEventListener('keydown', handleKeyDown)
    })

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
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                    gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
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
                                transform: `translate(${offsetCols * 100}%, ${offsetRows * 100}%)`,
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
