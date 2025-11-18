import { useState } from "react";

export default function TileSlideDemo() {
    const [slid, setSlid] = useState(false);

    return (
        <div style={{ width: "400px", margin: "40px auto", padding: "24px", background: "#f0f0f0", borderRadius: "12px", boxShadow: "0 2px 8px #0001" }}>
            <div style={{ height: "100px", width: "100%", position: "relative", overflow: "hidden" }}>
                <div
                    style={{
                        position: "absolute",
                        left: slid ? "300px" : "0px",
                        top: "20px",
                        width: "60px",
                        height: "60px",
                        background: "#ffcc00",
                        borderRadius: "8px",
                        transition: "left 0.4s cubic-bezier(.68,-0.55,.27,1.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: "1.5rem"
                    }}
                >
                    2
                </div>
            </div>
            <button
                style={{ marginTop: "24px", padding: "8px 24px", fontSize: "1rem", borderRadius: "6px", border: "none", background: "#007bff", color: "#fff", cursor: "pointer" }}
                onClick={() => setSlid((s) => !s)}
            >
                Slide
            </button>
        </div>
    );
}
