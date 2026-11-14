"""Educational LC-3 CPU. 16-bit words, word-addressed memory."""

from __future__ import annotations

from dataclasses import dataclass, field

MASK = 0xFFFF


def sext(value: int, bits: int) -> int:
    value &= (1 << bits) - 1
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


@dataclass
class CPU:
    registers: list[int] = field(default_factory=lambda: [0] * 8)
    memory: list[int] = field(default_factory=lambda: [0] * 65536)
    pc: int = 0x3000
    cc: str = "Z"
    halted: bool = False
    output: str = ""
    input_buffer: str = ""
    steps: int = 0
    ir: int = 0

    def reset(self):
        self.registers = [0] * 8
        self.memory = [0] * 65536
        (
            self.pc,
            self.cc,
            self.halted,
            self.output,
            self.input_buffer,
            self.steps,
            self.ir,
        ) = 0x3000, "Z", False, "", "", 0, 0

    def load(self, words: dict[int, int], origin: int = 0x3000):
        self.reset()
        for addr, word in words.items():
            self.memory[addr & MASK] = word & MASK
        self.pc = origin & MASK

    def setcc(self, value: int):
        value &= MASK
        self.cc = "Z" if value == 0 else ("N" if value & 0x8000 else "P")

    def state(self, around: int | None = None):
        center = self.pc if around is None else around & MASK
        return {
            "registers": self.registers.copy(),
            "pc": self.pc,
            "cc": self.cc,
            "halted": self.halted,
            "output": self.output,
            "steps": self.steps,
            "ir": self.ir,
            "psr": 0x8000 | {"N": 4, "Z": 2, "P": 1}[self.cc],
            "memory": [
                {
                    "address": (center + i) & MASK,
                    "value": self.memory[(center + i) & MASK],
                }
                for i in range(-5, 31)
            ],
        }

    def step(self):
        if self.halted:
            return {"halted": True, "changes": [], "explanation": "Program halted."}
        before = self.registers.copy()
        oldcc = self.cc
        address = self.pc
        instr = self.memory[address]
        # Do not consume an instruction while its input TRAP is waiting.
        if (instr & 0xFFFF) in (0xF020, 0xF023) and not self.input_buffer:
            raise ValueError(
                "Waiting for keyboard input: type a character in Console and press Send"
            )
        self.ir = instr
        self.pc = (self.pc + 1) & MASK
        op = instr >> 12
        dr, sr1 = (instr >> 9) & 7, (instr >> 6) & 7
        memchanges = []
        description = ""

        def store(addr, val):
            addr &= MASK
            old = self.memory[addr]
            self.memory[addr] = val & MASK
            memchanges.append(
                {"address": addr, "before": old, "after": self.memory[addr]}
            )

        def reg(index, val):
            self.registers[index] = val & MASK
            self.setcc(val)

        if op in (1, 5):  # ADD / AND
            b = sext(instr & 31, 5) if instr & 0x20 else self.registers[instr & 7]
            a = self.registers[sr1]
            result = a + b if op == 1 else a & b
            reg(dr, result)
            description = f"{'ADD' if op == 1 else 'AND'}: R{dr} = {a} {'+' if op == 1 else '&'} {b} = {result & MASK}."
        elif op == 9:  # NOT
            reg(dr, ~self.registers[sr1])
            description = f"NOT: bitwise complement of R{sr1} stored in R{dr}."
        elif op == 0:  # BR
            flags = (instr >> 9) & 7
            matched = (
                (self.cc == "N" and flags & 4)
                or (self.cc == "Z" and flags & 2)
                or (self.cc == "P" and flags & 1)
            )
            if matched:
                self.pc = (self.pc + sext(instr & 0x1FF, 9)) & MASK
            description = (
                f"BR: {'taken' if matched else 'not taken'} (condition {self.cc})."
            )
        elif op in (2, 10, 14):  # LD, LDI, LEA
            addr = (self.pc + sext(instr & 0x1FF, 9)) & MASK
            value = (
                addr
                if op == 14
                else self.memory[self.memory[addr] if op == 10 else addr]
            )
            reg(dr, value)
            description = {2: "LD", 10: "LDI", 14: "LEA"}[
                op
            ] + f": loaded x{value:04X} into R{dr}."
        elif op in (3, 11):  # ST, STI
            addr = (self.pc + sext(instr & 0x1FF, 9)) & MASK
            if op == 11:
                addr = self.memory[addr]
            store(addr, self.registers[dr])
            description = f"{'ST' if op == 3 else 'STI'}: stored R{dr} at x{addr:04X}."
        elif op == 6:  # LDR
            addr = (self.registers[sr1] + sext(instr & 63, 6)) & MASK
            reg(dr, self.memory[addr])
            description = f"LDR: loaded memory x{addr:04X} into R{dr}."
        elif op == 7:  # STR
            addr = (self.registers[sr1] + sext(instr & 63, 6)) & MASK
            store(addr, self.registers[dr])
            description = f"STR: stored R{dr} at x{addr:04X}."
        elif op == 4:  # JSR / JSRR
            target = (
                (self.pc + sext(instr & 0x7FF, 11)) & MASK
                if instr & 0x800
                else self.registers[sr1]
            )
            self.registers[7] = self.pc
            self.pc = target
            description = (
                f"JSR/JSRR: saved return address in R7, jumped to x{target:04X}."
            )
        elif op == 12:  # JMP / RET
            self.pc = self.registers[sr1]
            description = f"JMP: PC = R{sr1}."
        elif op == 8:
            raise ValueError(
                "RTI requires privileged execution and is not supported in this educational MVP"
            )
        elif op == 15:  # TRAP (basic console model, not full OS vector dispatch)
            vector = instr & 255
            self.registers[7] = self.pc
            if vector == 0x25:
                self.halted = True
                description = "HALT: program stopped."
            elif vector == 0x21:
                self.output += chr(self.registers[0] & 255)
                description = "OUT: emitted character from R0."
            elif vector == 0x22:
                ptr = self.registers[0]
                chars = []
                for _ in range(65536):
                    word = self.memory[ptr]
                    ptr = (ptr + 1) & MASK
                    if word == 0:
                        break
                    chars.append(chr(word & 255))
                self.output += "".join(chars)
                description = "PUTS: emitted null-terminated string."
            elif vector == 0x20:
                if not self.input_buffer:
                    raise ValueError("GETC requires queued input")
                self.registers[0] = ord(self.input_buffer[0]) & 255
                self.input_buffer = self.input_buffer[1:]
                description = "GETC: read character into R0."
            elif vector == 0x23:
                if not self.input_buffer:
                    raise ValueError("IN requires queued input")
                ch = self.input_buffer[0]
                self.input_buffer = self.input_buffer[1:]
                self.registers[0] = ord(ch) & 255
                self.output += ch
                description = "IN: read and echoed character."
            elif vector == 0x24:
                ptr = self.registers[0]
                chars = []
                for _ in range(65536):
                    word = self.memory[ptr]
                    ptr = (ptr + 1) & MASK
                    if word == 0:
                        break
                    chars.append(chr(word & 255))
                    if word >> 8:
                        chars.append(chr((word >> 8) & 255))
                self.output += "".join(chars)
                description = "PUTSP: emitted packed string."
            else:
                raise ValueError(f"TRAP x{vector:02X} not supported by MVP")
        else:
            raise ValueError(f"Unsupported opcode x{op:X} at x{address:04X}")
        self.steps += 1
        changes = [
            {"register": f"R{i}", "before": a, "after": b}
            for i, (a, b) in enumerate(zip(before, self.registers))
            if a != b
        ]
        return {
            "address": address,
            "instruction": instr,
            "opcode": op,
            "changes": changes,
            "memory_changes": memchanges,
            "cc_before": oldcc,
            "cc_after": self.cc,
            "pc_after": self.pc,
            "halted": self.halted,
            "explanation": description,
        }
