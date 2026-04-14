import { formatCount } from "./counter.ts"

if (formatCount(3) === "3 items") {
  process.exit(0)
}

console.error(`build failed: expected 3 items, received ${formatCount(3)}`)
process.exit(1)
