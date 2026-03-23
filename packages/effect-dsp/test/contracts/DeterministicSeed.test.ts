/**
 * Deterministic seed-stepping contract invariants.
 */
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect } from "effect"
import { nextDeterministicSeed, normalizeDeterministicSeed } from "../../src/contracts/DeterministicSeed.js"

const steppedSeeds = (
  seed: number,
  steps: number,
  acc: ReadonlyArray<number> = Arr.empty<number>()
): ReadonlyArray<number> =>
  steps <= 0
    ? acc
    : (() => {
      const next = nextDeterministicSeed(seed)

      return steppedSeeds(next, steps - 1, Arr.append(acc, next))
    })()

describe("contracts/DeterministicSeed", () => {
  it.effect("normalizes non-finite and non-positive values to deterministic positive seeds", () =>
    Effect.sync(() => {
      expect(normalizeDeterministicSeed(0)).toBe(1)
      expect(normalizeDeterministicSeed(-4.9)).toBe(4)
      expect(normalizeDeterministicSeed(Number.NaN)).toBe(1)
      expect(normalizeDeterministicSeed(Number.POSITIVE_INFINITY)).toBe(1)
    }))

  it.effect("produces the canonical LCG sequence for fixed seeds", () =>
    Effect.sync(() => {
      expect(steppedSeeds(normalizeDeterministicSeed(1), 3)).toEqual([
        1015568748,
        1586005467,
        2165703038
      ])
    }))

  it.effect("is deterministic across repeated stepping runs", () =>
    Effect.sync(() => {
      const first = steppedSeeds(normalizeDeterministicSeed(42), 12)
      const second = steppedSeeds(normalizeDeterministicSeed(42), 12)

      expect(second).toEqual(first)
    }))
})
