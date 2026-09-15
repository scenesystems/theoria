/**
 * Optimizer-level instruction extraction behavior.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { extractInstruction } from "../../src/Module/textGeneration.js"

describe("instruction extraction", () => {
  it.effect("extracts fenced text while preserving full-response and empty-fence fallbacks", () =>
    Effect.sync(() => {
      expect(extractInstruction("```text\n  Improve precisely.  \n```", "original")).toBe("Improve precisely.")
      expect(extractInstruction("  Improve directly.  ", "original")).toBe("Improve directly.")
      expect(extractInstruction("```\n   \n```", "original")).toBe("original")
      expect(extractInstruction("   ", "original")).toBe("original")
    }))
})
