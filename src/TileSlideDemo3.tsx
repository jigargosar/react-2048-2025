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
type MaybeTile = Tile | null
type Direction = 'left' | 'right' | 'up' | 'down'
type TileRow = readonly MaybeTile[]
type TileMatrix = Matrix<MaybeTile>

// Hardcoded initial tiles
const INITIAL_TILES: Tile[] = [
    { value: 2, position: { row: 0, col: 0 }, state: { type: 'static' } },
    { value: 4, position: { row: 0, col: 2 }, state: { type: 'static' } },
    { value: 2, position: { row: 1, col: 1 }, state: { type: 'static' } },
    { value: 8, position: { row: 2, col: 3 }, state: { type: 'static' } },
    { value: 2, position: { row: 3, col: 2 }, state: { type: 'static' } },
]

// Convert tiles array to 4x4 matrix
function tilesToMatrix(tiles: Tile[]): TileMatrix {
    const matrix: MaybeTile[][] = Array.from({ length: 4 }, () =>
        Array<MaybeTile>(4).fill(null),
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

function createStaticTile(tile: Tile): Tile {
    return { ...tile, state: { type: 'static' } }
}

function createMovedTile(tile: Tile): Tile {
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

// Slide and merge a single row of tiles left
function slideAndMergeRowLeft(row: TileRow): TileRow {
    // Filter non-null tiles and keep their original indices
    const nonNullTiles: Array<{ tile: Tile; originalIndex: number }> = []
    for (let i = 0; i < row.length; i++) {
        const tile = row[i]
        if (tile != null) {
            nonNullTiles.push({ tile, originalIndex: i })
        }
    }

    // Build result array with merging logic
    const result: MaybeTile[] = [null, null, null, null]
    let writePos = 0

    for (const { tile, originalIndex } of nonNullTiles) {
        const prevTile = writePos > 0 ? result[writePos - 1] : undefined

        // Check if we can merge with previous tile
        if (
            prevTile != null &&
            prevTile.state.type !== 'merged' &&
            prevTile.value === tile.value
        ) {
            // Merge: replace previous tile with merged version
            result[writePos - 1] = createMergedTile(prevTile, tile)
        } else {
            // No merge: determine state and write tile
            const newTile =
                writePos === originalIndex
                    ? createStaticTile(tile)
                    : createMovedTile(tile)
            result[writePos] = newTile
            writePos++
        }
    }

    return result
}

// Slide tiles left in matrix
function slideLeft(matrix: TileMatrix): TileMatrix {
    return matrix.map(slideAndMergeRowLeft)
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

// VIEW

function useTileSlide() {
    const [tiles, setTiles] = useState<Tile[]>(INITIAL_TILES)
    const [renderCounter, setRenderCounter] = useState(0)

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const direction = parseDirectionFromKey(event.key)
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
    }, [])

    return { tiles, renderCounter }
}

export function TileSlideDemo3() {
    const { tiles, renderCounter } = useTileSlide()

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
                {renderTiles(tiles)}
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

function renderTile(position: Position, value: number, key?: string) {
    return (
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
}

function renderTiles(tiles: Tile[]) {
    return tiles.map((tile, index) => {
        if (tile.state.type === 'merged') {
            return (
                <div key={String(index)} style={{ display: 'contents' }}>
                    {renderTile(tile.position, tile.state.value)}
                    {renderTile(tile.position, tile.state.value)}
                    {renderTile(tile.position, tile.value)}
                </div>
            )
        } else {
            return renderTile(tile.position, tile.value, String(index))
        }
    })
}
