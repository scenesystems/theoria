import { expect, it } from "@effect/vitest"
import { Data, Effect } from "effect"

import { canonicalize } from "../src/canonicalize.js"

const DEPTH = 100_000
const TEST_TIMEOUT_MILLIS = 30_000

class DeepValueState extends Data.Class<{
  readonly depth: number
  readonly value: unknown
}> {}

const nestedValue = (
  wrap: (value: unknown) => unknown
): Effect.Effect<unknown> =>
  Effect.map(
    Effect.iterate<DeepValueState, never, never>(new DeepValueState({ depth: 0, value: null }), {
      while: ({ depth }) => depth < DEPTH,
      body: ({ depth, value }) => Effect.succeed(new DeepValueState({ depth: depth + 1, value: wrap(value) }))
    }),
    ({ value }) => value
  )

it.effect("canonicalizes 100000 nested arrays without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue((child) => [child])
    const result = yield* canonicalize(value)
    expect(result).toBe(`${"[".repeat(DEPTH)}null${"]".repeat(DEPTH)}`)
  }), TEST_TIMEOUT_MILLIS)

it.effect("canonicalizes 100000 nested records without stack growth", () =>
  Effect.gen(function*() {
    const value = yield* nestedValue((child) => ({ value: child }))
    const result = yield* canonicalize(value)
    expect(result).toBe(`${"{\"value\":".repeat(DEPTH)}null${"}".repeat(DEPTH)}`)
  }), TEST_TIMEOUT_MILLIS)
