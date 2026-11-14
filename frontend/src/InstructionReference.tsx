const instructions = [
  [
    "ADD",
    "0001",
    "Add registers or a sign-extended immediate; sets N/Z/P.",
    "ADD R0, R1, #5",
  ],
  [
    "AND",
    "0101",
    "Bitwise AND with register or immediate; sets N/Z/P.",
    "AND R0, R0, #0",
  ],
  [
    "BR",
    "0000",
    "Branch based on the N, Z, P condition codes (BRn, BRz, BRp, BRnzp, etc.).",
    "BRz DONE",
  ],
  ["JMP / RET", "1100", "Set PC to a base register. RET is JMP R7.", "JMP R3"],
  [
    "JSR / JSRR",
    "0100",
    "Call subroutine, saving the return address in R7.",
    "JSR FUNCTION",
  ],
  ["LD", "0010", "Load from PC-relative address; sets N/Z/P.", "LD R0, VALUE"],
  [
    "LDI",
    "1010",
    "Load indirectly through a PC-relative pointer; sets N/Z/P.",
    "LDI R0, POINTER",
  ],
  [
    "LDR",
    "0110",
    "Load from base register plus signed offset; sets N/Z/P.",
    "LDR R0, R6, #0",
  ],
  [
    "LEA",
    "1110",
    "Load a PC-relative address, not its contents; sets N/Z/P in LC-3.",
    "LEA R0, MESSAGE",
  ],
  [
    "NOT",
    "1001",
    "Bitwise complement of source register; sets N/Z/P.",
    "NOT R0, R1",
  ],
  [
    "RTI",
    "1000",
    "Return from interrupt, restoring privileged state; not normally used in user programs.",
    "RTI",
  ],
  ["ST", "0011", "Store a register at a PC-relative address.", "ST R0, VALUE"],
  [
    "STI",
    "1011",
    "Store indirectly through a PC-relative pointer.",
    "STI R0, POINTER",
  ],
  [
    "STR",
    "0111",
    "Store at base register plus signed offset.",
    "STR R0, R6, #0",
  ],
  [
    "TRAP",
    "1111",
    "Invoke an operating-system service; stores return address in R7.",
    "TRAP x25",
  ],
] as const;
const traps = [
  ["x20", "GETC", "Read one character without echo"],
  ["x21", "OUT", "Print character in R0"],
  ["x22", "PUTS", "Print zero-terminated string"],
  ["x23", "IN", "Prompt, read and echo character"],
  ["x24", "PUTSP", "Print packed-character string"],
  ["x25", "HALT", "Stop execution"],
];
export default function InstructionReference() {
  return (
    <section className="dbg-isa">
      <h3>LC-3 instruction set</h3>
      <p className="muted tiny">
        All 15 defined opcodes. Opcode 1101 is reserved and is not an
        instruction.
      </p>
      <div className="isa-list">
        {instructions.map(([name, opcode, desc, example]) => (
          <article className="isa-item" key={name}>
            <div className="isa-item-top">
              <strong>{name}</strong>
              <code>{opcode}</code>
            </div>
            <p>{desc}</p>
            <code className="isa-example">{example}</code>
          </article>
        ))}
      </div>
      <h3>TRAP service routines</h3>
      <div className="isa-list">
        {traps.map(([vector, name, desc]) => (
          <article className="isa-item" key={vector}>
            <div className="isa-item-top">
              <strong>{name}</strong>
              <code>{vector}</code>
            </div>
            <p>{desc}</p>
          </article>
        ))}
      </div>
      <div className="isa-coming">
        <strong>Instruction execution flowchart — TBD</strong>
        <p>
          To be adapted from the ECE 220 lecture flowchart once the course
          reference is provided.
        </p>
      </div>
    </section>
  );
}
