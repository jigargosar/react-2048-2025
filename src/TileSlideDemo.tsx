import { useEffect, useState } from 'react';

type Pos = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';
type TileState = 'static' | 'moving';
type Tile = {
    pos: Pos;
    dest: Pos;
    state: TileState;
    value: number;
};

function posToGridArea(pos: Pos) {
    return {
        gridColumn: pos.x + 1,
        gridRow: pos.y + 1,
    };
}

const gridCols = 4;
const gridRows = 4;

const grid: Pos[][] = Array.from({ length: gridRows }, (_, y) =>
    Array.from({ length: gridCols }, (_, x) => ({ x, y }))
);
const allPos: Pos[] = grid.flat();

function computeDest(dir: Dir, pos: Pos): Pos {
    switch (dir) {
        case 'up': return { x: pos.x, y: 0 };
        case 'down': return { x: pos.x, y: gridRows - 1 };
        case 'left': return { x: 0, y: pos.y };
        case 'right': return { x: gridCols - 1, y: pos.y };
        default: return pos;
    }
}

function keyToDir(key: string): Dir | null {
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    return null;
}

const initialTiles: Tile[] = [
    { pos: { x: 0, y: 0 }, dest: { x: 0, y: 0 }, state: 'static', value: 2 },
    { pos: { x: 2, y: 1 }, dest: { x: 2, y: 1 }, state: 'static', value: 4 },
    { pos: { x: 3, y: 3 }, dest: { x: 3, y: 3 }, state: 'static', value: 8 },
    { pos: { x: 1, y: 2 }, dest: { x: 1, y: 2 }, state: 'static', value: 16 },
    { pos: { x: 1, y: 0 }, dest: { x: 1, y: 0 }, state: 'static', value: 32 },
    { pos: { x: 0, y: 3 }, dest: { x: 0, y: 3 }, state: 'static', value: 64 },
    { pos: { x: 2, y: 2 }, dest: { x: 2, y: 2 }, state: 'static', value: 128 },
    { pos: { x: 3, y: 0 }, dest: { x: 3, y: 0 }, state: 'static', value: 256 },
];

function slideLeft(tiles: Tile[], gridCols: number, gridRows: number): Tile[] {
    // Group tiles by row
    const rows: Tile[][] = Array.from({ length: gridRows }, () => []);
    tiles.forEach(tile => rows[tile.pos.y].push(tile));
    // For each row, sort by x and slide left
    return rows.flatMap(row => {
        // Sort tiles by x ascending
        const sorted = row.slice().sort((a, b) => a.pos.x - b.pos.x);
        // Slide tiles to the leftmost positions
        return sorted.map((tile, i) => ({
            ...tile,
            pos: { x: i, y: tile.pos.y },
            dest: { x: i, y: tile.pos.y },
        }));
    });
}

function rotateTiles(tiles: Tile[], gridCols: number, gridRows: number): Tile[] {
    // Rotates positions 90deg clockwise
    return tiles.map(tile => ({
        ...tile,
        pos: { x: gridRows - 1 - tile.pos.y, y: tile.pos.x },
        dest: { x: gridRows - 1 - tile.pos.y, y: tile.pos.x },
    }));
}
function rotateTilesCCW(tiles: Tile[], gridCols: number, gridRows: number): Tile[] {
    // Rotates positions 90deg counterclockwise
    return tiles.map(tile => ({
        ...tile,
        pos: { x: tile.pos.y, y: gridCols - 1 - tile.pos.x },
        dest: { x: tile.pos.y, y: gridCols - 1 - tile.pos.x },
    }));
}
function flipTiles(tiles: Tile[], gridCols: number): Tile[] {
    // Flips horizontally
    return tiles.map(tile => ({
        ...tile,
        pos: { x: gridCols - 1 - tile.pos.x, y: tile.pos.y },
        dest: { x: gridCols - 1 - tile.pos.x, y: tile.pos.y },
    }));
}

function transformForDirection(tiles: Tile[], dir: Dir, gridCols: number, gridRows: number): Tile[] {
    switch (dir) {
        case 'left':
            return tiles;
        case 'right':
            return flipTiles(tiles, gridCols);
        case 'up':
            return rotateTilesCCW(tiles, gridCols, gridRows);
        case 'down':
            return rotateTiles(tiles, gridCols, gridRows);
        default:
            return tiles;
    }
}
function inverseTransformForDirection(tiles: Tile[], dir: Dir, gridCols: number, gridRows: number): Tile[] {
    switch (dir) {
        case 'left':
            return tiles;
        case 'right':
            return flipTiles(tiles, gridCols);
        case 'up':
            return rotateTiles(tiles, gridCols, gridRows);
        case 'down':
            return rotateTilesCCW(tiles, gridCols, gridRows);
        default:
            return tiles;
    }
}

export default function TileSlideDemo() {
    const [tiles, setTiles] = useState<Tile[]>(initialTiles);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const dir = keyToDir(e.key);
            if (!dir) return;
            e.preventDefault();
            // Transform tiles for leftward slide
            let workingTiles = transformForDirection(tiles, dir, gridCols, gridRows);
            // Slide left
            workingTiles = slideLeft(workingTiles, gridCols, gridRows);
            // Transform tiles back to original orientation
            workingTiles = inverseTransformForDirection(workingTiles, dir, gridCols, gridRows);
            // Snap all tiles to static
            setTiles(workingTiles.map(tile => ({ ...tile, state: 'static' as TileState })));
            requestAnimationFrame(() => {
                setTiles(workingTiles.map(tile => ({ ...tile, state: 'moving' as TileState })));
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [tiles]);

    return (
        <div
            style={{
                width: '400px',
                margin: '40px auto',
                padding: '24px',
                background: '#f0f0f0',
                borderRadius: '12px',
                boxShadow: '0 2px 8px #0001',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                    width: '100%',
                    height: '400px',
                    alignItems: 'center',
                    position: 'relative',
                    background: '#eee',
                }}
            >
                {allPos.map(pos => (
                    <div
                        key={`${pos.x},${pos.y}`}
                        style={{
                            ...posToGridArea(pos),
                            width: '100%',
                            height: '100%',
                        }}
                    />
                ))}
                {tiles.map((tile, idx) => (
                    <div
                        key={idx}
                        style={{
                            gridColumn: 1,
                            gridRow: 1,
                            width: '100%',
                            height: '100%',
                            background: '#ffcc00',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.5rem',
                            transform: `translateX(${tile.pos.x * 100}%) translateY(${tile.pos.y * 100}%)`,
                            transition: tile.state === 'moving' ? 'transform 0.2s linear' : 'none',
                        }}
                    >
                        {tile.value}
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '24px', color: '#333' }}>
                Use arrow keys to move the tiles
            </div>
        </div>
    );
}
