import { useState } from 'react'
import { flushSync } from 'react-dom'

type Tile = {
  id: number
  value: number
  row: number
  col: number
  visualCol: number
}

type Direction = 'left' | 'right'

const GRID_SIZE = 4

function slideLeft(tiles: Tile[]): Tile[] {
  const rows: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

  tiles.forEach(tile => {
    rows[tile.row].push(tile)
  })

  const newTiles: Tile[] = []
  rows.forEach((rowTiles, rowIndex) => {
    const sorted = rowTiles.sort((a, b) => a.visualCol - b.visualCol)
    sorted.forEach((tile, index) => {
      newTiles.push({
        ...tile,
        col: index
      })
    })
  })

  return newTiles
}

function slideRight(tiles: Tile[]): Tile[] {
  const rows: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

  tiles.forEach(tile => {
    rows[tile.row].push(tile)
  })

  const newTiles: Tile[] = []
  rows.forEach((rowTiles, rowIndex) => {
    const sorted = rowTiles.sort((a, b) => b.visualCol - a.visualCol)
    sorted.forEach((tile, index) => {
      const newCol = GRID_SIZE - 1 - index
      newTiles.push({
        ...tile,
        col: newCol
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
    default:
      return tiles
  }
}

export default function TileSlideDemo2() {
  const [tiles, setTiles] = useState<Tile[]>([
    { id: 1, value: 2, row: 0, col: 1, visualCol: 1 },
    { id: 2, value: 4, row: 0, col: 3, visualCol: 3 },
    { id: 3, value: 8, row: 1, col: 2, visualCol: 2 },
    { id: 4, value: 16, row: 2, col: 0, visualCol: 0 },
    { id: 5, value: 32, row: 2, col: 3, visualCol: 3 },
    { id: 6, value: 64, row: 3, col: 1, visualCol: 1 }
  ])
  const [renderKey, setRenderKey] = useState(0)

  const handleKeyDown = (e: KeyboardEvent) => {
    let direction: Direction | null = null

    if (e.key === 'ArrowLeft') {
      direction = 'left'
    } else if (e.key === 'ArrowRight') {
      direction = 'right'
    }

    if (direction) {
      // Step 1: Update col and increment key
      flushSync(() => {
        setTiles(tiles => {
          const normalized = tiles.map(tile => ({
            ...tile,
            col: tile.visualCol
          }))
          return slide(normalized, direction!)
        })
        setRenderKey(k => k + 1)
      })

      // Step 2: After browser paints, update visualCol for animation
      requestAnimationFrame(() => {
        setTiles(tiles => tiles.map(tile => ({
          ...tile,
          visualCol: tile.col
        })))
      })
    }
  }

  useState(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#1a1a1a'
    }}>
      <h1 style={{ marginBottom: '20px', color: '#fff' }}>Slide Left Test</h1>

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
          height: '400px'
        }}>
        {tiles.map(tile => {
          const offsetCols = tile.visualCol - tile.col
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
                transform: `translateX(${offsetCols * 100}%)`,
                transition: 'transform 200ms ease-in-out'
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
                  color: '#fff'
                }}
              >
                {tile.value}
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ marginTop: '20px', color: '#ccc' }}>
        Press Left/Right Arrow to slide
      </p>
    </div>
  )
}