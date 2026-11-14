export const examples = [
  {
    name: "Hello, BitBuddy!",
    source:
      '.ORIG x3000\n    LEA R0, MESSAGE\n    PUTS\n    HALT\nMESSAGE .STRINGZ "Hello, BitBuddy!"\n.END',
  },
  {
    name: "Addition",
    source:
      ".ORIG x3000\n    AND R0, R0, #0\n    ADD R0, R0, #5\n    ADD R0, R0, #3\n    HALT\n.END",
  },
  {
    name: "Countdown loop",
    source:
      ".ORIG x3000\n    AND R1, R1, #0\n    ADD R1, R1, #5\nLOOP ADD R1, R1, #-1\n    BRp LOOP\n    HALT\n.END",
  },
  {
    name: "Keyboard echo",
    source: ".ORIG x3000\n    GETC\n    OUT\n    HALT\n.END",
  },
];
