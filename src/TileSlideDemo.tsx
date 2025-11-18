import { useState } from "react";

export default function TileSlideDemo() {
    const gridCols = 4;
    const [col, setCol] = useState(0); // 0 (left) to 3 (right)

    return (
        <div style={{ width: "400px", margin: "40px auto", padding: "24px", background: "#f0f0f0", borderRadius: "12px", boxShadow: "0 2px 8px #0001" }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gridTemplateRows: "1fr",
                    width: "100%",
                    height: "100px",
                    alignItems: "center",
                    position: "relative",
                    background: "#eee",
                }}
            >
                {[...Array(gridCols)].map((_, i) => (
                    <div key={i} style={{ width: "100%", height: "100%" }} />
                ))}
                <div
                    style={{
                        gridColumn: 1,
                        gridRow: 1,
                        width: "100%",
                        height: "100%",
                        background: "#ffcc00",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "1.5rem",
                        transform: `translateX(${col * 100}%)`,
                        transition: "transform 0.4s linear"
                    }}
                >
                    2
                </div>
            </div>
            <button
                style={{ marginTop: "24px", padding: "8px 24px", fontSize: "1rem", borderRadius: "6px", border: "none", background: "#007bff", color: "#fff", cursor: "pointer" }}
                onClick={() => setCol(col < gridCols - 1 ? col + 1 : 0)}
            >
                Slide
            </button>
        </div>
    );
}
