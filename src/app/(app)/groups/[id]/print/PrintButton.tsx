"use client"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: "#7c3aed", color: "white", border: "none",
        borderRadius: 8, padding: "10px 20px", fontWeight: 600,
        fontSize: 14, cursor: "pointer",
      }}
    >
      Print / Save as PDF
    </button>
  )
}
