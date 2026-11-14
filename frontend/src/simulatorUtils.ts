export const hex = (n: number) =>
  "x" + (n & 65535).toString(16).toUpperCase().padStart(4, "0");

export const signed = (n: number) => (n & 32768 ? n - 65536 : n);

export async function request(path: string, body?: unknown) {
  const res = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.detail || "Request failed");
  return data;
}

export function parseValue(text: string) {
  const t = text.trim();
  if (/^x[\da-f]+$/i.test(t)) return parseInt(t.slice(1), 16);
  if (/^0x[\da-f]+$/i.test(t)) return parseInt(t.slice(2), 16);
  if (/^0b[01]+$/i.test(t)) return parseInt(t.slice(2), 2);
  if (/^#?-?\d+$/.test(t)) return Number(t.replace("#", ""));
  throw Error("Enter x3000, 0x3000, 0b1010, or decimal");
}

export function disasm(word: number, addr: number) {
  const op = word >>> 12,
    dr = (word >>> 9) & 7,
    sr = (word >>> 6) & 7,
    se = (n: number, b: number) => (n & (1 << (b - 1)) ? n - (1 << b) : n);
  if (word === 0) return "NOP";
  if (op === 1 || op === 5)
    return `${op === 1 ? "ADD" : "AND"} R${dr}, R${sr}, ${word & 32 ? "#" + se(word & 31, 5) : "R" + (word & 7)}`;
  if (op === 9) return `NOT R${dr}, R${sr}`;
  if (op === 0)
    return `BR${word & 0xe00 ? "" : ""}${word & 0x800 ? "n" : ""}${word & 0x400 ? "z" : ""}${word & 0x200 ? "p" : ""} ${hex((addr + 1 + se(word & 511, 9)) & 65535)}`;
  if ([2, 3, 10, 11, 14].includes(op))
    return `${({ 2: "LD", 3: "ST", 10: "LDI", 11: "STI", 14: "LEA" } as Record<number, string>)[op]} R${dr}, ${hex((addr + 1 + se(word & 511, 9)) & 65535)}`;
  if (op === 6 || op === 7)
    return `${op === 6 ? "LDR" : "STR"} R${dr}, R${sr}, #${se(word & 63, 6)}`;
  if (op === 4)
    return word & 0x800
      ? `JSR ${hex((addr + 1 + se(word & 2047, 11)) & 65535)}`
      : `JSRR R${sr}`;
  if (op === 12) return sr === 7 ? "RET" : `JMP R${sr}`;
  if (op === 15)
    return (
      (
        {
          32: "GETC",
          33: "OUT",
          34: "PUTS",
          35: "IN",
          36: "PUTSP",
          37: "HALT",
        } as Record<number, string>
      )[word & 255] || `TRAP x${(word & 255).toString(16).toUpperCase()}`
    );
  return `.FILL ${hex(word)}`;
}
