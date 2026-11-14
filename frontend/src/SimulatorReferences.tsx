import { useState } from "react";

const regions = [
  {
    id: "stack",
    name: "Stack",
    detail:
      "Call frames, return addresses, and local variables in a typical C runtime.",
    color: "#e9ddff",
    direction: "Grows downward ↓",
  },
  {
    id: "heap",
    name: "Heap",
    detail: "Dynamically allocated objects in a typical C runtime.",
    color: "#dceffc",
    direction: "Grows upward ↑",
  },
  {
    id: "bss",
    name: ".bss",
    detail: "Zero-initialized and uninitialized static/global variables.",
    color: "#dff5e9",
    direction: "Static storage",
  },
  {
    id: "data",
    name: ".data",
    detail: "Initialized writable static/global variables.",
    color: "#ffebdb",
    direction: "Static storage",
  },
  {
    id: "text",
    name: ".text",
    detail: "Executable instructions (machine code).",
    color: "#ffe1eb",
    direction: "Program code",
  },
] as const;

export function MemoryLayoutPanel() {
  return (
    <section className="panel memory-education memory-tbd">
      <div className="panel-heading">
        <h3>Memory layout</h3>
        <span className="memory-concept-label">Coming soon</span>
      </div>
      <h4>ECE 220 memory layout — TBD</h4>
      <p>
        We’ll build this section around the ECE 220 lecture diagrams, including
        the course’s conventions and examples.
      </p>
      <p className="muted tiny">
        The previous generic C memory diagram has been removed to avoid implying
        it represents the LC-3 memory map.
      </p>
    </section>
  );
}

const controlNames: Record<number, string> = {
  0: "NUL",
  1: "SOH",
  2: "STX",
  3: "ETX",
  4: "EOT",
  5: "ENQ",
  6: "ACK",
  7: "BEL",
  8: "BS",
  9: "TAB",
  10: "LF",
  11: "VT",
  12: "FF",
  13: "CR",
  14: "SO",
  15: "SI",
  16: "DLE",
  17: "DC1",
  18: "DC2",
  19: "DC3",
  20: "DC4",
  21: "NAK",
  22: "SYN",
  23: "ETB",
  24: "CAN",
  25: "EM",
  26: "SUB",
  27: "ESC",
  28: "FS",
  29: "GS",
  30: "RS",
  31: "US",
  32: "SPACE",
  127: "DEL",
};
export function AsciiReference() {
  const [filter, setFilter] = useState("");
  const rows = Array.from({ length: 128 }, (_, n) => ({
    n,
    label: controlNames[n] ?? String.fromCharCode(n),
  })).filter((r) =>
    [
      String(r.n),
      r.n.toString(16).padStart(2, "0"),
      r.label.toLowerCase(),
    ].some((x) => x.toLowerCase().includes(filter.toLowerCase().trim())),
  );
  return (
    <section className="panel ascii-reference">
      <div className="panel-heading">
        <h3>ASCII reference</h3>
        <span className="memory-concept-label">7-bit · 0–127</span>
      </div>
      <p className="muted tiny">
        Look up character codes when using GETC, OUT, PUTS or .STRINGZ.
      </p>
      <input
        className="ascii-search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Search ASCII table"
        placeholder="Search character, decimal, or hex…"
      />
      <div className="ascii-scroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Dec</th>
              <th>Hex</th>
              <th>Binary</th>
              <th>Character</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td>x{r.n.toString(16).toUpperCase().padStart(2, "0")}</td>
                <td>{r.n.toString(2).padStart(8, "0")}</td>
                <td>{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="muted tiny">No matching ASCII codes.</p>
        )}
      </div>
    </section>
  );
}
