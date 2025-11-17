import { useState, useEffect } from 'react';

type Row = number[];
type Grid = Row[];

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

function App() {
  const [grid, setGrid] = useState<Grid>(initialGrid);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setGrid(g => slideLeft(g));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
      <h1 className="text-3xl font-bold mb-8 text-gray-100">2048 Game Mockup</h1>
      <div className="bg-gray-800 p-3 rounded-2xl shadow-2xl inline-block">
        <div className="grid grid-cols-4 grid-rows-4 gap-2 bg-gray-700 p-2 rounded-xl">
          {grid.map((row, rowIdx) => (
            row.map((value, colIdx) => (
              <div
                key={rowIdx * 4 + colIdx}
                className={`w-16 h-16 flex items-center justify-center rounded-lg font-bold text-lg border-2 border-gray-900 transition-all
                  ${value === 0 ? 'bg-gray-800 text-gray-600' : 'bg-yellow-600 text-gray-900'}`}
              >
                {value !== 0 ? value : ''}
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
