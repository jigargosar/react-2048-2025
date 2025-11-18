import { useEffect, useState } from 'react';

type Pos = { x: number; y: number };

function posToGridArea(pos: Pos) {
    return {
        gridColumn: pos.x + 1,
        gridRow: pos.y + 1,
    };
}

const gridCols = 4;
const gridRows = 4;

function computeDest(dir: string, pos: Pos): Pos {
    switch (dir) {
        case 'up': return { x: pos.x, y: 0 };
        case 'down': return { x: pos.x, y: gridRows - 1 };
        case 'left': return { x: 0, y: pos.y };
        case 'right': return { x: gridCols - 1, y: pos.y };
        default: return pos;
    }
}

function keyToDir(key: string): 'up' | 'down' | 'left' | 'right' | null {
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    return null;
}

export default function TileSlideDemo() {
    const [tile, setTile] = useState({
        pos: { x: 0, y: 0 } as Pos,
        dest: { x: 0, y: 0 } as Pos,
        state: 'static' as 'static' | 'moving',
        dir: null as null | 'up' | 'down' | 'left' | 'right',
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const dir = keyToDir(e.key);
            if (!dir) return;
            e.preventDefault();
            const newDest = computeDest(dir, tile.pos);
            if (newDest.x === tile.pos.x && newDest.y === tile.pos.y) return;
            // Snap to current destination (static)
            setTile(t => ({ ...t, state: 'static' }));
            requestAnimationFrame(() => {
                setTile({
                    pos: newDest,
                    dest: newDest,
                    state: 'moving',
                    dir,
                });
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [tile.pos]);

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
                {[...Array(gridRows)].flatMap((_, row) =>
                    [...Array(gridCols)].map((_, col) => (
                        <div
                            key={row * gridCols + col}
                            style={{
                                ...posToGridArea({ x: col, y: row }),
                                width: '100%',
                                height: '100%',
                            }}
                        />
                    )),
                )}
                <div
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
            </div>
            <div style={{ marginTop: '24px', color: '#333' }}>
                Use arrow keys to move the tile
            </div>
        </div>
    );
}
