from app.lc3.assembler import assemble
from app.lc3.cpu import CPU, sext


def test_add_and_halt():
    a = assemble(".ORIG x3000\nAND R0,R0,#0\nADD R0,R0,#5\nADD R0,R0,#3\nHALT\n.END")
    cpu = CPU()
    cpu.load(a["memory"], a["origin"])
    for _ in range(4):
        cpu.step()
    assert cpu.registers[0] == 8 and cpu.cc == "P" and cpu.halted


def test_branch():
    a = assemble(
        ".ORIG x3000\nAND R0,R0,#0\nBRz SKIP\nADD R0,R0,#1\nSKIP ADD R0,R0,#2\nHALT\n.END"
    )
    cpu = CPU()
    cpu.load(a["memory"], a["origin"])
    for _ in range(4):
        cpu.step()
    assert cpu.registers[0] == 2


def test_sign_and_overflow():
    cpu = CPU()
    cpu.registers[0] = 0xFFFF
    cpu.memory[0x3000] = 0x1021  # ADD R0,R0,#1
    cpu.step()
    assert cpu.registers[0] == 0 and cpu.cc == "Z"
    assert sext(0b11111, 5) == -1


def test_memory_and_labels():
    a = assemble(
        ".ORIG x3000\nLD R1, VALUE\nST R1, DEST\nHALT\nVALUE .FILL x1234\nDEST .BLKW #1\n.END"
    )
    cpu = CPU()
    cpu.load(a["memory"], a["origin"])
    for _ in range(3):
        cpu.step()
    assert cpu.memory[a["symbols"]["DEST"]] == 0x1234


def test_stringz():
    a = assemble('.ORIG x3000\nLEA R0, MSG\nPUTS\nHALT\nMSG .STRINGZ "Hi!"\n.END')
    cpu = CPU()
    cpu.load(a["memory"], a["origin"])
    for _ in range(3):
        cpu.step()
    assert cpu.output == "Hi!"


def test_waiting_for_input_does_not_advance_pc():
    a = assemble(".ORIG x3000\nGETC\nOUT\nHALT\n.END")
    cpu = CPU()
    cpu.load(a["memory"], a["origin"])
    import pytest

    with pytest.raises(ValueError, match="Waiting for keyboard input"):
        cpu.step()
    assert cpu.pc == 0x3000
    cpu.input_buffer = "A"
    cpu.step()
    cpu.step()
    assert cpu.output == "A"


def test_instruction_register_and_psr():
    cpu = CPU()
    cpu.memory[0x3000] = 0x1021
    cpu.step()
    s = cpu.state()
    assert s["ir"] == 0x1021
    assert s["psr"] & 7 == 1
    assert len(s["memory"]) == 36
