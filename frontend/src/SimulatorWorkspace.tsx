import type { State, Trace, Listing } from "./simulatorTypes";
import { examples } from "./simulatorExamples";
import { hex, signed, request, parseValue, disasm } from "./simulatorUtils";
import { useEffect, useRef, useState } from "react";
import { AsciiReference, MemoryLayoutPanel } from "./SimulatorReferences";
import "./simulator.css";
import FancySelect from "./FancySelect";
import InstructionReference from "./InstructionReference";

const tabs = ["ASCII", "Memory layout", "Instruction set"] as const;
export default function SimulatorWorkspace() {
  const [source, setSource] = useState(examples[0].source),
    [editor, setEditor] = useState(false),
    [state, setState] = useState<State | null>(null),
    [assembled, setAssembled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [trace, setTrace] = useState<Trace | null>(null),
    [listing, setListing] = useState<Listing[]>([]),
    [symbols, setSymbols] = useState<Record<string, number>>({}),
    [addr, setAddr] = useState("x3000"),
    [center, setCenter] = useState(0x3000),
    [follow, setFollow] = useState(true),
    [format, setFormat] = useState<"hex" | "decimal" | "binary">("hex"),
    [breakpoints, setBreakpoints] = useState<number[]>([]),
    [explain, setExplain] = useState(false),
    [refTab, setRefTab] = useState<(typeof tabs)[number]>("ASCII"),
    [refsOpen, setRefsOpen] = useState(false),
    [input, setInput] = useState(""),
    [history, setHistory] = useState<Trace[]>([]),
    [editValue, setEditValue] = useState<{
      kind: "register" | "memory";
      index: number;
      value: string;
    } | null>(null),
    [running, setRunning] = useState(false);
  const stop = useRef(false),
    memoryRef = useRef<HTMLDivElement>(null);
  const formatWord = (n: number) =>
    format === "hex"
      ? hex(n)
      : format === "decimal"
        ? String(signed(n))
        : "0b" + (n & 65535).toString(2).padStart(16, "0");
  useEffect(() => {
    request("state")
      .then((s) => {
        setState(s);
        setCenter(s.pc);
      })
      .catch(() =>
        setError("Backend unavailable. Start uvicorn on port 8000."),
      );
  }, []);
  useEffect(() => {
    if (follow && state) setCenter(state.pc);
  }, [state?.pc, follow]);
  useEffect(() => {
    if (memoryRef.current && follow) memoryRef.current.scrollTop = 0;
  }, [center, follow]);
  const lines = new Map<number, string>();
  for (const item of listing)
    for (let i = 0; i < item.words.length; i++)
      lines.set((item.address + i) & 65535, item.source);
  const labels = new Map<number, string>();
  Object.entries(symbols).forEach(([label, a]) => labels.set(a, label));
  const windowAddresses = Array.from(
    { length: 36 },
    (_, i) => (center + i - 5 + 65536) & 65535,
  );
  const memMap = new Map(
    (state?.memory || []).map((x) => [x.address, x.value]),
  );
  async function refresh(at?: number) {
    const s: State = await request("state");
    setState(s);
    if (at !== undefined) {
      const m = await request("memory?address=" + hex(at));
      setState({ ...s, memory: m.memory });
    }
  }
  async function action(path: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await request(path, body);
      if (path === "assemble") {
        setState(d.state);
        setListing(d.listing || []);
        setSymbols(d.symbols || {});
        setAssembled(true);
        setHistory([]);
        setTrace(null);
        setBreakpoints([]);
        setCenter(d.state.pc);
        setNotice("Assembled successfully");
        setEditor(false);
      } else if (path === "reset") {
        setState(d);
        setAssembled(false);
        setTrace(null);
        setHistory([]);
        setNotice("Reset complete. Assemble to reload the program.");
      } else if (path === "step" || path === "next") {
        setState(d.state);
        if (d.trace) {
          setTrace(d.trace);
          setHistory((h) => [d.trace, ...h].slice(0, 30));
        }
      } else if (path === "input") {
        setNotice("Input queued");
      } else if (path === "register" || path === "write-memory") {
        setState(d.state);
        setNotice("Value updated");
      } else if (path === "run") {
        setState(d.state);
        setTrace(
          d.traces && d.traces.length ? d.traces[d.traces.length - 1] : null,
        );
        setHistory((h) => [...(d.traces || []).reverse(), ...h].slice(0, 30));
        setNotice(
          d.reason === "breakpoint"
            ? "Paused at breakpoint " + hex(d.state.pc)
            : d.reason === "input"
              ? "Waiting for keyboard input"
              : d.reason === "limit"
                ? "Paused after instruction limit"
                : d.state.halted
                  ? "Program halted"
                  : "Paused",
        );
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setRunning(false);
    }
  }
  async function run() {
    stop.current = false;
    setRunning(true);
    await action("run", { breakpoints, max_steps: 5000 });
  }
  function jump() {
    try {
      const target = Object.keys(symbols).find(
        (k) => k.toUpperCase() === addr.trim().toUpperCase(),
      );
      const n = target !== undefined ? symbols[target] : parseValue(addr);
      if (n < 0 || n > 65535) throw Error("Address out of range");
      setCenter(n);
      setFollow(false);
      request("memory?address=" + hex(n))
        .then((d) => setState((s) => (s ? { ...s, memory: d.memory } : s)))
        .catch((e) => setError(String(e)));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }
  async function saveEdit() {
    if (!editValue) return;
    try {
      const v = parseValue(editValue.value);
      if (v < -32768 || v > 65535) throw Error("Value must fit in 16 bits");
      await action(
        editValue.kind === "register" ? "register" : "write-memory",
        editValue.kind === "register"
          ? { index: editValue.index, value: v }
          : { address: editValue.index, value: v },
      );
      setEditValue(null);
      if (editValue.kind === "memory") {
        const d = await request("memory?address=" + hex(center));
        setState((s) => (s ? { ...s, memory: d.memory } : s));
      }
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className="debugger">
      <div className="debugger-title">
        <div>
          <h1>LC-3 Simulator</h1>
        </div>
        <div className="debugger-title-actions">
          <button
            className="dbg-button"
            onClick={() => {
              setRefsOpen((x) => !x);
              setExplain(false);
            }}
          >
            ▤ References
          </button>
          <button
            className="dbg-button primary"
            onClick={() => setEditor(true)}
          >
            ✎ Edit program
          </button>
        </div>
      </div>
      {error && (
        <div className="dbg-alert" role="alert">
          ⚠ {error}
        </div>
      )}
      {notice && (
        <div className="dbg-note" role="status">
          ✦ {notice}
        </div>
      )}
      <div className="debugger-columns">
        <section className="dbg-pane dbg-memory">
          <div className="dbg-heading">
            <h2>Memory</h2>
            <span className="dbg-subtle">65,536 × 16-bit words</span>
          </div>
          <div className="dbg-search">
            <input
              aria-label="Jump to address or label"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && jump()}
              placeholder="Jump to address or label"
            />
            <button onClick={jump}>Jump</button>
            <button
              onClick={() => {
                if (state) {
                  setCenter(state.pc);
                  setFollow(true);
                }
              }}
            >
              ↪ PC
            </button>
          </div>
          <div className="dbg-memory-scroll" ref={memoryRef}>
            <table className="dbg-table">
              <thead>
                <tr>
                  <th aria-label="Breakpoint">●</th>
                  <th>Address</th>
                  <th>Label</th>
                  <th>Hex</th>
                  <th>Instruction / data</th>
                </tr>
              </thead>
              <tbody>
                {windowAddresses.map((a) => {
                  const word = memMap.get(a);
                  const active = a === state?.pc;
                  return (
                    <tr
                      key={a}
                      className={`${active ? "dbg-pc" : ""} ${trace?.memory_changes.some((c) => c.address === a) ? "dbg-changed" : ""}`}
                    >
                      <td>
                        <button
                          aria-label={`${breakpoints.includes(a) ? "Remove" : "Set"} breakpoint at ${hex(a)}`}
                          className={
                            "dbg-breakpoint " +
                            (breakpoints.includes(a) ? "on" : "")
                          }
                          onClick={() =>
                            setBreakpoints((b) =>
                              b.includes(a)
                                ? b.filter((x) => x !== a)
                                : [...b, a],
                            )
                          }
                        >
                          {breakpoints.includes(a) ? "●" : "○"}
                        </button>
                      </td>
                      <td className="mono">
                        {hex(a)}
                        {active ? " ▸" : ""}
                      </td>
                      <td className="dbg-label">{labels.get(a) || "—"}</td>
                      <td>
                        <button
                          className="dbg-cell mono"
                          disabled={!state}
                          title="Edit memory word"
                          onClick={() =>
                            setEditValue({
                              kind: "memory",
                              index: a,
                              value: hex(word || 0),
                            })
                          }
                        >
                          {word === undefined ? "…" : hex(word)}
                        </button>
                      </td>
                      <td className="mono dbg-instruction">
                        {word === undefined
                          ? "…"
                          : lines.has(a)
                            ? disasm(word, a)
                            : disasm(word, a)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="dbg-bottom">
            <label>
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />{" "}
              Follow PC
            </label>
            <span>Click ● to set breakpoints · CLICK HEX TO EDIT</span>
          </div>
        </section>
        <div className="dbg-side">
          <section className="dbg-pane">
            <div className="dbg-heading">
              <h2>CPU status</h2>
              <span className={"dbg-status " + (state?.halted ? "halted" : "")}>
                {state?.halted ? "● Halted" : assembled ? "● Ready" : "○ Idle"}
              </span>
            </div>
            <div className="dbg-registers">
              {Array.from({ length: 8 }, (_, i) => (
                <button
                  key={i}
                  className={
                    "dbg-register " +
                    (trace?.changes.some((c) => c.register === `R${i}`)
                      ? "dbg-changed"
                      : "")
                  }
                  onClick={() =>
                    state &&
                    setEditValue({
                      kind: "register",
                      index: i,
                      value: hex(state.registers[i]),
                    })
                  }
                >
                  <span>R{i}</span>
                  <strong>
                    {state ? formatWord(state.registers[i]) : "—"}
                  </strong>
                </button>
              ))}
            </div>
            <div className="dbg-special">
              <span>
                PC <b>{state ? hex(state.pc) : "—"}</b>
              </span>
              <span>
                IR <b>{state ? hex(state.ir) : "—"}</b>
              </span>
              <span>
                PSR <b>{state ? hex(state.psr) : "—"}</b>
              </span>
              <span>
                CC <b>{state?.cc || "—"}</b>
              </span>
            </div>
            <div className="dbg-toolbar">
              <button
                disabled={!assembled || busy || state?.halted}
                onClick={() => action("step")}
              >
                ↦ Step
              </button>
              <button
                disabled={!assembled || busy || state?.halted}
                onClick={() => action("next")}
              >
                ⇥ Next
              </button>
              <button
                className="accent"
                disabled={!assembled || busy || state?.halted}
                onClick={run}
              >
                ▶ Run
              </button>
              <button
                disabled={!running}
                onClick={() => {
                  stop.current = true;
                  request("pause", {}).catch((e) => setError(String(e)));
                }}
              >
                Ⅱ Pause
              </button>
              <button
                disabled={!assembled || busy || state?.halted}
                onClick={run}
              >
                ↻ Continue
              </button>
              <button disabled={busy} onClick={() => action("reset")}>
                ⟲ Reset
              </button>
            </div>
            <div className="dbg-settings">
              <label>
                Display{" "}
                <FancySelect
                  ariaLabel="Display format"
                  value={format}
                  onChange={(value) => setFormat(value as typeof format)}
                  options={[
                    { value: "hex", label: "Hex" },
                    { value: "decimal", label: "Signed decimal" },
                    { value: "binary", label: "Binary" },
                  ]}
                />
              </label>
              <button
                className="dbg-link"
                onClick={() => setExplain((x) => !x)}
              >
                {explain ? "Hide" : "Show"} explanations
              </button>
            </div>
          </section>
          <section className="dbg-pane dbg-console">
            <div className="dbg-heading">
              <h2>Console</h2>
              <span className="dbg-subtle">TRAP I/O</span>
            </div>
            <pre aria-label="Program output" className="dbg-output">
              {state?.output || "Your program output will appear here."}
            </pre>
            <form
              className="dbg-console-input"
              onSubmit={(e) => {
                e.preventDefault();
                if (input) {
                  action("input", { text: input });
                  setInput("");
                }
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Keyboard input for GETC / IN"
                aria-label="Console keyboard input"
              />
              <button disabled={!input || busy}>Send ↵</button>
            </form>
          </section>
          {explain && (
            <section className="dbg-pane dbg-explain">
              <div className="dbg-heading">
                <h2>✨ BitBuddy explains</h2>
                <button
                  onClick={() => setExplain(false)}
                  aria-label="Close explanations"
                >
                  ×
                </button>
              </div>
              {trace ? (
                <>
                  <p>
                    <b>{hex(trace.address)}</b> — {trace.explanation}
                  </p>
                  {trace.changes.map((c) => (
                    <p key={c.register} className="dbg-delta">
                      {c.register}: {hex(c.before)} →{" "}
                      <strong>{hex(c.after)}</strong>
                    </p>
                  ))}
                  {trace.memory_changes.map((c) => (
                    <p key={c.address} className="dbg-delta">
                      [{hex(c.address)}]: {hex(c.before)} →{" "}
                      <strong>{hex(c.after)}</strong>
                    </p>
                  ))}
                </>
              ) : (
                <p className="dbg-subtle">
                  Assemble and step through a program to see instruction
                  explanations.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      <div className="dbg-footer">
        <span>
          {assembled ? "✓ Program assembled" : "○ Assemble a program to begin"}{" "}
          · {state?.steps || 0} instructions executed · {breakpoints.length}{" "}
          breakpoints
        </span>
        <button onClick={() => setEditor(true)}>Open assembly editor →</button>
      </div>
      {editor && (
        <div
          className="dbg-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditor(false);
          }}
        >
          <section
            className="dbg-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Assembly editor"
          >
            <div className="dbg-drawer-head">
              <div>
                <span className="eyebrow">ASSEMBLY PLAYGROUND</span>
                <h2>✎ Program editor</h2>
              </div>
              <button
                onClick={() => setEditor(false)}
                aria-label="Close editor"
              >
                ×
              </button>
            </div>
            <div className="dbg-example">
              <label>
                Load example{" "}
                <FancySelect
                  ariaLabel="Load example"
                  value={examples.find((x) => x.source === source)?.name || ""}
                  onChange={(value) => {
                    const ex = examples.find((x) => x.name === value);
                    if (ex) {
                      setSource(ex.source);
                      setAssembled(false);
                    }
                  }}
                  options={[
                    { value: "", label: "Custom program" },
                    ...examples.map((e) => ({ value: e.name, label: e.name })),
                  ]}
                />
              </label>
            </div>
            <textarea
              className="dbg-editor"
              spellCheck={false}
              aria-label="LC-3 source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setAssembled(false);
              }}
            />
            <div className="dbg-drawer-actions">
              <button
                disabled={busy}
                className="dbg-button primary"
                onClick={() => action("assemble", { source })}
              >
                ⚙ Assemble & load
              </button>
            </div>
          </section>
        </div>
      )}
      {refsOpen && (
        <div
          className="dbg-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRefsOpen(false);
          }}
        >
          <section
            className="dbg-drawer dbg-ref-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="LC-3 references"
          >
            <div className="dbg-drawer-head">
              <h2>▤ Quick references</h2>
              <button
                onClick={() => setRefsOpen(false)}
                aria-label="Close references"
              >
                ×
              </button>
            </div>
            <div className="dbg-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  role="tab"
                  aria-selected={refTab === t}
                  className={refTab === t ? "active" : ""}
                  key={t}
                  onClick={() => setRefTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="dbg-ref-content">
              {refTab === "ASCII" ? (
                <AsciiReference />
              ) : refTab === "Memory layout" ? (
                <MemoryLayoutPanel />
              ) : (
                <InstructionReference />
              )}
            </div>
          </section>
        </div>
      )}
      {editValue && (
        <div className="dbg-overlay dbg-edit-overlay">
          <form
            className="dbg-edit-modal"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
          >
            <h2>
              Edit{" "}
              {editValue.kind === "register"
                ? `R${editValue.index}`
                : `memory ${hex(editValue.index)}`}
            </h2>
            <p>
              Enter a 16-bit value in hex (x1234), decimal, or binary (0b1010).
            </p>
            <input
              autoFocus
              value={editValue.value}
              onChange={(e) =>
                setEditValue({ ...editValue, value: e.target.value })
              }
            />
            <div>
              <button type="button" onClick={() => setEditValue(null)}>
                Cancel
              </button>
              <button type="submit" className="accent">
                Save value
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
