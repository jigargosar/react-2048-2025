import { useEffect, useState } from 'react';

type Pos = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';
type TileState = 'static' | 'moving';
type Tile = {
    pos: Pos;
    dest: Pos;
    state: TileState;
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
    { pos: { x: 0, y: 0 }, dest: { x: 0, y: 0 }, state: 'static' },
    { pos: { x: 2, y: 1 }, dest: { x: 2, y: 1 }, state: 'static' },
    { pos: { x: 3, y: 3 }, dest: { x: 3, y: 3 }, state: 'static' },
];

export default function TileSlideDemo() {
    const [tiles, setTiles] = useState<Tile[]>(initialTiles);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const dir = keyToDir(e.key);
            if (!dir) return;
            e.preventDefault();
            // Compute new destinations for all tiles, ensuring no overlap
            const claimed = new Set<string>();
            const nextTiles = tiles.map(tile => {
                const newDest = computeDest(dir, tile.pos);
                const destKey = `${newDest.x},${newDest.y}`;
                if (claimed.has(destKey)) {
                    // Destination already claimed, stay in place
                    return { ...tile, state: 'static' as TileState };
                }
                claimed.add(destKey);
                if (newDest.x === tile.pos.x && newDest.y === tile.pos.y) {
                    return { ...tile, state: 'static' as TileState };
                }
                return { ...tile, state: 'static' as TileState };
            });
            setTiles(nextTiles);
            requestAnimationFrame(() => {
                const claimedAnim = new Set<string>();
                setTiles(nextTiles.map(tile => {
                    const newDest = computeDest(dir, tile.pos);
                    const destKey = `${newDest.x},${newDest.y}`;
                    if (claimedAnim.has(destKey)) {
                        // Destination already claimed, stay in place
                        return { ...tile, state: 'static' as TileState };
                    }
                    claimedAnim.add(destKey);
                    if (newDest.x === tile.pos.x && newDest.y === tile.pos.y) {
                        return { ...tile, state: 'static' as TileState };
                    }
                    return {
                        ...tile,
                        pos: newDest,
                        dest: newDest,
                        state: 'moving' as TileState,
                    };
                }));
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
                        2
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '24px', color: '#333' }}>
                Use arrow keys to move the tiles
            </div>
        </div>
    );
}
