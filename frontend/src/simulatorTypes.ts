export type State = {
  registers: number[];
  pc: number;
  cc: string;
  halted: boolean;
  output: string;
  steps: number;
  ir: number;
  psr: number;
  memory: { address: number; value: number }[];
  input_waiting?: boolean;
};

export type Trace = {
  address: number;
  instruction: number;
  changes: { register: string; before: number; after: number }[];
  memory_changes: { address: number; before: number; after: number }[];
  explanation: string;
  pc_after: number;
  halted: boolean;
};

export type Listing = {
  address: number;
  words: number[];
  source: string;
  line: number;
};
