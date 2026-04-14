import { formatCount } from "./counter.ts"

if (formatCount(2) === "2 items") {
  process.exit(0)
}

console.error(`test failed: expected 2 items, received ${formatCount(2)}`)
process.exit(1)
