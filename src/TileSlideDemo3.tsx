import { useEffect, useState } from 'react'
import { pipe } from 'fp-ts/function'
import { flatten, inc } from 'ramda'
import { keepNonNil, type Matrix, reverseRows, transpose } from './utils.ts'

// Types
type Position = { row: number; col: number }
type TileState =
    | { type: 'static' }
    | { type: 'moved'; from: Position }
    | { type: 'merged'; from1: Position; from2: Position; value: number }
type Tile = { value: number; position: Position; state: TileState }
type Direction = 'left' | 'right' | 'up' | 'down'
type TileMatrix = Matrix<Tile | null>

// Hardcoded initial tiles
const INITIAL_TILES: Tile[] = [
    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
    { value: 4, position: { row: 0, col: 2 }, state: { type: 'static' } },
    { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
    { value: 8, position: { row: 2, col: 3 }, state: { type: 'static' } },
    { value: 2, position: { row: 3, col: 2 }, state: { type: 'static' } },
]

// Helper to get tile background color
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

// Helper to get tile text color
function getTileTextColor(value: number): string {
    return value <= 4 ? '#776e65' : '#f9f6f2'
}

// Convert tiles array to 4x4 matrix
function tilesToMatrix(tiles: Tile[]): TileMatrix {
    const matrix: (Tile | null)[][] = Array.from({ length: 4 }, () =>
        Array<Tile | null>(4).fill(null),
    )
    for (const tile of tiles) {
        const row = matrix[tile.position.row]
        if (row) {
            row[tile.position.col] = tile
        }
    }

    return matrix
}

// Set all tiles state to static
function setTilesStateStatic(tiles: Tile[]): Tile[] {
    return tiles.map((tile) => ({
        ...tile,
        state: { type: 'static' },
    }))
}

// Update tile positions based on their location in the matrix
function setPositionsFromMatrix(matrix: TileMatrix): TileMatrix {
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

// Slide tiles left in matrix
function slideLeft(matrix: TileMatrix): TileMatrix {
    return matrix.map((row) => {
        const tiles = keepNonNil(row)
        const newRow: (Tile | null)[] = Array<Tile | null>(4).fill(null)

        let newColIndex = 0
        let i = 0

        while (i < tiles.length) {
            const currentTile = tiles[i]
            const nextTile = tiles[i + 1]

            if (!currentTile) break

            // Check if we can merge with next tile
            if (nextTile && currentTile.value === nextTile.value) {
                // Merge the two tiles
                newRow[newColIndex] = {
                    value: currentTile.value * 2,
                    position: currentTile.position,
                    state: {
                        type: 'merged',
                        from1: { ...currentTile.position },
                        from2: { ...nextTile.position },
                        value: currentTile.value,
                    },
                }
                i += 2 // Skip both tiles
            } else {
                // Just move the tile
                const moved = currentTile.position.col !== newColIndex
                newRow[newColIndex] = {
                    value: currentTile.value,
                    position: currentTile.position,
                    state: moved
                        ? { type: 'moved', from: { ...currentTile.position } }
                        : { type: 'static' },
                }
                i += 1
            }
            newColIndex++
        }

        return newRow
    })
}

// Slide tiles in the specified direction
function slideAndMergeMatrix(
    matrix: TileMatrix,
    direction: Direction,
): TileMatrix {
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
function slideAndMergeTiles(tiles: Tile[], direction: Direction): Tile[] {
    return pipe(
        tiles,
        tilesToMatrix,
        (matrix) => slideAndMergeMatrix(matrix, direction),
        setPositionsFromMatrix,
        flatten,
        keepNonNil,
    )
}

export function TileSlideDemo3() {
    const [tiles, setTiles] = useState<Tile[]>(INITIAL_TILES)
    const [renderCounter, setRenderCounter] = useState(0)

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            let direction: Direction | null = null
            switch (event.key) {
                case 'ArrowLeft':
                    direction = 'left'
                    break
                case 'ArrowRight':
                    direction = 'right'
                    break
                case 'ArrowUp':
                    direction = 'up'
                    break
                case 'ArrowDown':
                    direction = 'down'
                    break
            }

            if (direction) {
                setTiles(setTilesStateStatic)
                setRenderCounter(inc)
                requestAnimationFrame(() => {
                    setTiles((prevTiles) => {
                        return slideAndMergeTiles(prevTiles, direction)
                    })
                })
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [tiles])

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
                2048 Demo 3 - Hardcoded Tiles
            </h1>

            <div
                key={renderCounter}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gridTemplateRows: 'repeat(4, 1fr)',
                    gap: '0',
                    background: '#2d2d2d',
                    borderRadius: '8px',
                    width: '400px',
                    height: '400px',
                }}
            >
                {tiles.flatMap((tile, idx) => {
                    const renderTile = (
                        position: Position,
                        value: number,
                        key: string,
                    ) => (
                        <div
                            key={key}
                            style={{
                                gridColumn: position.col + 1,
                                gridRow: position.row + 1,
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
                                    backgroundColor: getTileColor(value),
                                    color: getTileTextColor(value),
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: value >= 1000 ? '35px' : '55px',
                                    fontWeight: 'bold',
                                }}
                            >
                                {value}
                            </div>
                        </div>
                    )

                    if (tile.state.type === 'merged') {
                        // Render 3 tiles: two source tiles + merged tile
                        return [
                            renderTile(
                                tile.state.from1,
                                tile.state.value,
                                `${String(idx)}-from1`,
                            ),
                            renderTile(
                                tile.state.from2,
                                tile.state.value,
                                `${String(idx)}-from2`,
                            ),
                            renderTile(tile.position, tile.value, `${String(idx)}-merged`),
                        ]
                    } else {
                        // Render single tile
                        return [renderTile(tile.position, tile.value, String(idx))]
                    }
                })}
            </div>
        </div>
    )
}
