import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./counter.ts", import.meta.url), "utf8")

if (source.includes("`${count} items`")) {
  process.exit(0)
}

console.error("check failed: counter.ts still does not derive the required item label")
process.exit(1)
