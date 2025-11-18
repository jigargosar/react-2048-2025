import { useEffect, useState } from 'react';


type Row = number[];
type Grid = Row[];
type Position = { x: number; y: number };

const GRID_SIZE = 4;

const gridPositions: Position[] = Array.from(
  { length: GRID_SIZE * GRID_SIZE },
  (_, i) => ({
    x: i % GRID_SIZE,
    y: Math.floor(i / GRID_SIZE),
  })
);

const initialGrid: Grid = [
  [2, 0, 0, 2],
  [0, 4, 8, 0],
  [16, 0, 0, 32],
  [0, 64, 0, 128],
];

function slideLeft(grid: Grid): Grid {
  return grid.map((row: Row) => {
    const filtered = row.filter((v: number) => v !== 0);
    const zeros = Array(row.length - filtered.length).fill(0);
    return [...filtered, ...zeros];
  });
}


function renderGrid(grid: Grid, animating: boolean) {
  // Render static background tiles
  const backgroundTiles = gridPositions.map((pos, idx) => (
    <div
      key={"bg-" + idx}
      style={{
        gridArea: `${pos.y + 1} / ${pos.x + 1} / ${pos.y + 2} / ${pos.x + 2}`,
      }}
      className="w-16 h-16 flex items-center justify-center rounded-lg border-2 border-gray-900 bg-gray-800 text-gray-600"
    />
  ));

  // Render only non-zero tiles
  const tiles = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const value = grid[y][x];
      if (value !== 0) {
        tiles.push(
          <div
            key={`tile-${y}-${x}`}
            style={{
              gridArea: `${y + 1} / ${x + 1} / ${y + 2} / ${x + 2}`,
              zIndex: 2,
              transition: 'transform 0.3s',
              transform: animating ? 'scale(1.1)' : 'scale(1)',
            }}
            className="w-16 h-16 flex items-center justify-center rounded-lg font-bold text-lg border-2 border-gray-900 bg-yellow-600 text-gray-900 absolute"
          >
            {value}
          </div>
        );
      }
    }
  }

  return (
    <div
      className="relative grid"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${GRID_SIZE}, 4rem)`,
        gridTemplateColumns: `repeat(${GRID_SIZE}, 4rem)`,
        gap: '0.5rem',
        background: '#374151',
        padding: '0.5rem',
        borderRadius: '1rem',
        width: `${GRID_SIZE * 4.5}rem`,
        height: `${GRID_SIZE * 4.5}rem`,
      }}
    >
      {backgroundTiles}
      {tiles}
    </div>
  );
}

function App() {
  const [grid, setGrid] = useState<Grid>(initialGrid);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setAnimating(true);
        setTimeout(() => {
          setGrid((g) => slideLeft(g));
          setAnimating(false);
        }, 300); // match duration-300
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-gray-100">
        2048 Game Mockup
      </h1>
      <div className="bg-gray-800 p-3 rounded-2xl shadow-2xl inline-block">
        {renderGrid(grid, animating)}
      </div>
    </div>
  );
}

export default App;
