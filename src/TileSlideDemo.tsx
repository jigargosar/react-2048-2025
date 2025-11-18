import { useEffect, useState } from 'react';

function posToGridArea({ x, y }: { x: number; y: number }) {
    // gridColumn and gridRow are 1-based in CSS Grid
    return {
        gridColumn: x + 1,
        gridRow: y + 1,
    };
}

export default function TileSlideDemo() {
    const gridCols = 4;
    const gridRows = 4;
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // x: col, y: row

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            setPos((prev: { x: number; y: number }) => {
                let { x, y } = prev;
                if (e.key === 'ArrowUp') y = Math.max(0, y - 1);
                if (e.key === 'ArrowDown') y = Math.min(gridRows - 1, y + 1);
                if (e.key === 'ArrowLeft') x = Math.max(0, x - 1);
                if (e.key === 'ArrowRight') x = Math.min(gridCols - 1, x + 1);
                return { x, y };
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
                        transform: `translateX(${pos.x * 100}%) translateY(${pos.y * 100}%)`,
                        transition: 'transform 0.4s linear',
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
