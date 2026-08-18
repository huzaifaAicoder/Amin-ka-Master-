import { readFileSync } from "node:fs";

const lines = readFileSync("app/operations/control.tsx", "utf8").split("\n");
const source = lines[41] ?? "";
const stack = [];
for (let index = 0; index < source.length; index += 1) {
  const char = source[index];
  if (char === "{") stack.push(index);
  if (char === "}") stack.pop();
}
for (const index of stack) {
  console.log(index, source.slice(Math.max(0, index - 70), index + 130));
}
