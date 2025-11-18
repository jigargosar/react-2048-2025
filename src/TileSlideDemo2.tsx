import { useState } from 'react'

type Tile = {
  id: number
  value: number
  row: number
  col: number
}

const GRID_SIZE = 4

function slideLeft(tiles: Tile[]): Tile[] {
  const rows: Tile[][] = Array.from({ length: GRID_SIZE }, () => [])

  tiles.forEach(tile => {
    rows[tile.row].push(tile)
  })

  const newTiles: Tile[] = []
  rows.forEach((rowTiles, rowIndex) => {
    const sorted = rowTiles.sort((a, b) => a.col - b.col)
    sorted.forEach((tile, index) => {
      newTiles.push({
        ...tile,
        col: index
      })
    })
  })

  return newTiles
}

export default function TileSlideDemo2() {
  const [tiles, setTiles] = useState<Tile[]>([
    { id: 1, value: 2, row: 0, col: 1 },
    { id: 2, value: 4, row: 0, col: 3 },
    { id: 3, value: 8, row: 1, col: 2 },
    { id: 4, value: 16, row: 2, col: 0 },
    { id: 5, value: 32, row: 2, col: 3 },
    { id: 6, value: 64, row: 3, col: 1 }
  ])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setTiles(tiles => slideLeft(tiles))
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
      background: '#faf8ef'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Slide Left Test</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, 80px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 80px)`,
        gap: '10px',
        padding: '10px',
        background: '#bbada0',
        borderRadius: '8px',
        position: 'relative'
      }}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(238, 228, 218, 0.35)',
              borderRadius: '4px'
            }}
          />
        ))}

        {tiles.map(tile => (
          <div
            key={tile.id}
            style={{
              position: 'absolute',
              width: '80px',
              height: '80px',
              background: '#edc22e',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '32px',
              color: '#776e65',
              transform: `translate(${tile.col * 90}px, ${tile.row * 90}px)`,
              transition: 'transform 200ms ease-in-out'
            }}
          >
            {tile.value}
          </div>
        ))}
      </div>

      <p style={{ marginTop: '20px', color: '#776e65' }}>
        Press Left Arrow to slide
      </p>
    </div>
  )
}