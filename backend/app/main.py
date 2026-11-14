import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .lc3.assembler import AssemblyError, assemble
from .lc3.cpu import CPU

app = FastAPI(title="BitBuddy LC-3 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
cpu = (
    CPU()
)  # Single shared demo session; replace with per-user sessions before deployment.
pause_requested = False


class Source(BaseModel):
    source: str


class Input(BaseModel):
    text: str


class RunOptions(BaseModel):
    breakpoints: list[int] = Field(default_factory=list)
    max_steps: int = Field(default=5000, ge=1, le=10000)


class RegisterEdit(BaseModel):
    index: int
    value: int


class MemoryEdit(BaseModel):
    address: int
    value: int


@app.get("/api/state")
def state():
    return cpu.state()


@app.post("/api/assemble")
def load(body: Source):
    try:
        result = assemble(body.source)
        cpu.load(result["memory"], result["origin"])
        return {
            "state": cpu.state(),
            "listing": result["listing"],
            "symbols": result["symbols"],
        }
    except (AssemblyError, ValueError) as e:
        raise HTTPException(400, str(e))


@app.get("/api/memory")
def memory(address: str):
    try:
        if address.lower().startswith("x"):
            center = int(address[1:], 16)
        elif address.lower().startswith("0x"):
            center = int(address, 16)
        else:
            center = int(address, 10)
        if not 0 <= center <= 0xFFFF:
            raise ValueError("Address must be between 0 and 65535")
        return {"memory": cpu.state(around=center)["memory"]}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/step")
def step():
    try:
        return {"trace": cpu.step(), "state": cpu.state()}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/run")
async def run(options: RunOptions):
    global pause_requested
    pause_requested = False
    traces = []
    reason = "limit"
    for index in range(options.max_steps):
        if index % 50 == 0:
            await asyncio.sleep(0.001)
        if pause_requested:
            reason = "paused"
            break
        if cpu.halted:
            reason = "halted"
            break
        if cpu.pc in options.breakpoints:
            reason = "breakpoint"
            break
        try:
            traces.append(cpu.step())
        except ValueError as e:
            if "Waiting for keyboard input" in str(e):
                reason = "input"
                break
            raise HTTPException(400, str(e))
        if cpu.halted:
            reason = "halted"
            break
    return {
        "traces": traces[-30:],
        "executed": len(traces),
        "reason": reason,
        "state": cpu.state(),
    }


@app.post("/api/pause")
def pause():
    global pause_requested
    pause_requested = True
    return {"paused": True}


@app.post("/api/next")
def next_instruction():
    # Step over JSR/JSRR by executing until the return address is reached.
    instruction = cpu.memory[cpu.pc]
    if instruction >> 12 != 4:
        return step()
    return_pc = (cpu.pc + 1) & 0xFFFF
    first = step()["trace"]
    last = first
    for _ in range(4999):
        if cpu.halted or cpu.pc == return_pc:
            break
        try:
            last = cpu.step()
        except ValueError as e:
            raise HTTPException(400, str(e))
    return {"trace": last, "state": cpu.state()}


@app.post("/api/register")
def edit_register(body: RegisterEdit):
    if not 0 <= body.index < 8:
        raise HTTPException(400, "Register index must be 0–7")
    if not -32768 <= body.value <= 65535:
        raise HTTPException(400, "Value must fit in 16 bits")
    cpu.registers[body.index] = body.value & 0xFFFF
    return {"state": cpu.state()}


@app.post("/api/write-memory")
def edit_memory(body: MemoryEdit):
    if not 0 <= body.address <= 65535:
        raise HTTPException(400, "Address must fit in 16 bits")
    if not -32768 <= body.value <= 65535:
        raise HTTPException(400, "Value must fit in 16 bits")
    cpu.memory[body.address] = body.value & 0xFFFF
    return {"state": cpu.state()}


@app.post("/api/reset")
def reset():
    cpu.reset()
    return cpu.state()


@app.post("/api/input")
def input_text(body: Input):
    cpu.input_buffer += body.text
    return {"queued": len(cpu.input_buffer)}
