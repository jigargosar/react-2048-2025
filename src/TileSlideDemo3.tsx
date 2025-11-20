import { useState } from 'react'

// Types
type Position = { row: number; col: number }
type Tile = { value: number; position: Position }

// Hardcoded initial tiles
const INITIAL_TILES: Tile[] = [
  { value: 2, position: { row: 0, col: 0 } },
  { value: 4, position: { row: 0, col: 2 } },
  { value: 2, position: { row: 1, col: 1 } },
  { value: 8, position: { row: 2, col: 3 } },
  { value: 2, position: { row: 3, col: 2 } },
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

export function TileSlideDemo3() {
  const [tiles] = useState<Tile[]>(INITIAL_TILES)

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
        {tiles.map((tile, idx) => (
          <div
            key={idx}
            style={{
              gridColumn: tile.position.col + 1,
              gridRow: tile.position.row + 1,
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
                backgroundColor: getTileColor(tile.value),
                color: getTileTextColor(tile.value),
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: tile.value >= 1000 ? '35px' : '55px',
                fontWeight: 'bold',
              }}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
