import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, pipe, Tuple } from "effect"

import * as Lifecycle from "@scenesystems/effect-study/Lifecycle"

const transition = (self: Lifecycle.Lifecycle, target: Lifecycle.Lifecycle) => Tuple.make(self, target)

it.effect("allows only declared non-terminal lifecycle transitions", () =>
  Effect.sync(() => {
    const allowed = Arr.make(
      transition("Created", "Running"),
      transition("Running", "Paused"),
      transition("Running", "Completed"),
      transition("Running", "Failed"),
      transition("Running", "Cancelled"),
      transition("Paused", "Running"),
      transition("Paused", "Cancelled")
    )

    expect(Arr.every(allowed, ([self, target]) => Lifecycle.canTransition(self, target))).toBe(true)
    expect(pipe("Created", Lifecycle.canTransition("Paused"))).toBe(false)
    expect(Lifecycle.canTransition("Completed", "Running")).toBe(false)
    expect(Lifecycle.canTransition("Failed", "Running")).toBe(false)
    expect(Lifecycle.canTransition("Cancelled", "Running")).toBe(false)
  }))
