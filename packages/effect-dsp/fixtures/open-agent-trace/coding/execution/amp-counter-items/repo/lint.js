import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./counter.ts", import.meta.url), "utf8")

if (!source.includes("count=") && source.includes("items")) {
  process.exit(0)
}

console.error("lint failed: legacy formatting string still present")
process.exit(1)
