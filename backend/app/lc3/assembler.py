"""Two-pass LC-3 assembler for educational programs. Returns address->word mapping."""

import ast
import re

from .cpu import sext

OPS = {
    "ADD",
    "AND",
    "NOT",
    "BR",
    "BRN",
    "BRZ",
    "BRP",
    "BRNZ",
    "BRNP",
    "BRZP",
    "BRNZP",
    "LD",
    "LDI",
    "LDR",
    "LEA",
    "ST",
    "STI",
    "STR",
    "JSR",
    "JSRR",
    "JMP",
    "RET",
    "TRAP",
    "HALT",
    "OUT",
    "PUTS",
    "GETC",
    "IN",
    "PUTSP",
    "RTI",
}
DIRECTIVES = {".ORIG", ".END", ".FILL", ".BLKW", ".STRINGZ"}


class AssemblyError(ValueError):
    pass


def number(s):
    s = s.strip()
    if s.startswith("#"):
        return int(s[1:], 10)
    if s.lower().startswith("x"):
        return int(s[1:], 16)
    if s.lower().startswith("0x"):
        return int(s, 16)
    if s.lower().startswith("b") and len(s) > 1 and all(c in "01" for c in s[1:]):
        return int(s[1:], 2)
    return int(s, 10)


def register(s):
    if not re.fullmatch(r"R[0-7]", s.upper()):
        raise AssemblyError(f"Invalid register: {s}")
    return int(s[1])


def bits(v, width, signed=True):
    lo = -(1 << (width - 1)) if signed else 0
    hi = (1 << (width - 1)) - 1 if signed else (1 << width) - 1
    if not lo <= v <= hi:
        raise AssemblyError(
            f"{v} does not fit {width}-bit {'signed' if signed else 'unsigned'} field"
        )
    return v & ((1 << width) - 1)


def parse(source):
    rows = []
    for lineno, raw in enumerate(source.splitlines(), 1):
        # strip comments, preserving quoted string literals
        quoted = False
        escaped = False
        out = ""
        for c in raw:
            if c == '"' and not escaped:
                quoted = not quoted
            if c == ";" and not quoted:
                break
            out += c
            escaped = c == "\\" and not escaped
            if c != "\\":
                escaped = False
        line = out.strip()
        if not line:
            continue
        match = re.match(r"^(\S+)(?:\s+(.*))?$", line)
        first, rest = match.group(1), match.group(2) or ""
        if first.upper() not in OPS | DIRECTIVES:
            label = first.upper()
            if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", label):
                raise AssemblyError(f"Line {lineno}: invalid label {first}")
            if not rest:
                raise AssemblyError(f"Line {lineno}: label without instruction")
            second = re.match(r"^(\S+)(?:\s+(.*))?$", rest)
            op, args = second.group(1).upper(), second.group(2) or ""
        else:
            label = None
            op, args = first.upper(), rest
        if op not in OPS | DIRECTIVES:
            raise AssemblyError(f"Line {lineno}: unknown operation {op}")
        if op == ".STRINGZ":
            try:
                value = ast.literal_eval(args)
            except (ValueError, SyntaxError) as exc:
                raise AssemblyError(f"Line {lineno}: invalid .STRINGZ literal") from exc
            if not isinstance(value, str):
                raise AssemblyError(f"Line {lineno}: invalid .STRINGZ literal")
            operands = [value]
        else:
            operands = [a.strip() for a in args.split(",") if a.strip()]
        rows.append((lineno, label, op, operands))
    return rows


def assemble(source):
    rows = parse(source)
    symbols = {}
    origin = None
    pc = 0
    located = []
    ended = False
    for line, label, op, args in rows:
        if ended:
            break
        if op == ".ORIG":
            if origin is not None:
                raise AssemblyError("Only one .ORIG segment is supported")
            if len(args) != 1:
                raise AssemblyError(f"Line {line}: .ORIG requires address")
            origin = number(args[0])
            bits(origin, 16, False)
            pc = origin
            continue
        if origin is None:
            raise AssemblyError("Program must begin with .ORIG")
        if op == ".END":
            ended = True
            continue
        if label:
            if label in symbols:
                raise AssemblyError(f"Line {line}: duplicate label {label}")
            symbols[label] = pc
        size = number(args[0]) if op == ".BLKW" and len(args) == 1 else 1
        if op == ".STRINGZ":
            size = len(args[0]) + 1
        if size < 0 or pc + size > 65536:
            raise AssemblyError(f"Line {line}: memory bounds exceeded")
        located.append((line, pc, op, args))
        pc += size
    if origin is None:
        raise AssemblyError("Missing .ORIG")
    memory = {}
    listing = []

    def val(s):
        return symbols[s.upper()] if s.upper() in symbols else number(s)

    def rel(s, addr, width):
        if s.upper() in symbols:
            delta = (symbols[s.upper()] - (addr + 1)) & 0xFFFF
            return bits(sext(delta, 16), width)
        return bits(number(s), width)

    for line, addr, op, a in located:
        try:

            def require(n, operands=a, operation=op):
                if len(operands) != n:
                    raise AssemblyError(
                        f"{operation} expects {n} operand(s), got {len(operands)}"
                    )

            words = []
            if op == ".FILL":
                require(1)
                words = [
                    bits(val(a[0]), 16, True)
                    if val(a[0]) < 0
                    else bits(val(a[0]), 16, False)
                ]
            elif op == ".BLKW":
                require(1)
                words = [0] * number(a[0])
            elif op == ".STRINGZ":
                words = [ord(c) for c in a[0]] + [0]
            elif op in ("ADD", "AND"):
                require(3)
                base = (
                    (1 if op == "ADD" else 5) << 12
                    | register(a[0]) << 9
                    | register(a[1]) << 6
                )
                if a[2].upper().startswith("R"):
                    words = [base | register(a[2])]
                else:
                    words = [base | 0x20 | bits(number(a[2]), 5)]
            elif op == "NOT":
                require(2)
                words = [0x9000 | register(a[0]) << 9 | register(a[1]) << 6 | 0x3F]
            elif op.startswith("BR"):
                require(1)
                flags = op[2:] or "NZP"
                mask = sum(v for k, v in [("N", 4), ("Z", 2), ("P", 1)] if k in flags)
                words = [mask << 9 | rel(a[0], addr, 9)]
            elif op in ("LD", "LDI", "LEA", "ST", "STI"):
                require(2)
                opcode = {"LD": 2, "LDI": 10, "LEA": 14, "ST": 3, "STI": 11}[op]
                words = [opcode << 12 | register(a[0]) << 9 | rel(a[1], addr, 9)]
            elif op in ("LDR", "STR"):
                require(3)
                words = [
                    (6 if op == "LDR" else 7) << 12
                    | register(a[0]) << 9
                    | register(a[1]) << 6
                    | bits(number(a[2]), 6)
                ]
            elif op == "JSR":
                require(1)
                words = [0x4800 | rel(a[0], addr, 11)]
            elif op in ("JSRR", "JMP"):
                require(1)
                words = [(0x4000 if op == "JSRR" else 0xC000) | register(a[0]) << 6]
            elif op == "RET":
                require(0)
                words = [0xC1C0]
            elif op == "RTI":
                require(0)
                words = [0x8000]
            elif op == "TRAP":
                require(1)
                words = [0xF000 | bits(number(a[0]), 8, False)]
            elif op in ("GETC", "OUT", "PUTS", "IN", "PUTSP", "HALT"):
                require(0)
                words = [
                    0xF000
                    | {
                        "GETC": 0x20,
                        "OUT": 0x21,
                        "PUTS": 0x22,
                        "IN": 0x23,
                        "PUTSP": 0x24,
                        "HALT": 0x25,
                    }[op]
                ]
            else:
                raise AssemblyError(f"Unknown operation {op}")
            for i, word in enumerate(words):
                if not 0 <= word <= 65535:
                    raise AssemblyError("Word outside 16-bit range")
                memory[addr + i] = word
            listing.append(
                {
                    "line": line,
                    "address": addr,
                    "words": words,
                    "source": op + " " + ", ".join(a),
                }
            )
        except (ValueError, IndexError) as exc:
            raise AssemblyError(f"Line {line}: {exc}") from exc
    return {"origin": origin, "memory": memory, "listing": listing, "symbols": symbols}
