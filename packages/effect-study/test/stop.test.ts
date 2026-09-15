import { expect, it } from "@effect/vitest"
import { Chunk, Effect, Option, Ref } from "effect"

import * as Stop from "../src/Stop.js"

const earliestInterrupt = new Stop.Request({
  mode: "Interrupt",
  reason: "alpha",
  requestedByTrialNumber: 1
})

const requests = Chunk.make(
  new Stop.Request({ mode: "Drain", reason: "alpha", requestedByTrialNumber: 2 }),
  new Stop.Request({ mode: "Drain", reason: "omega", requestedByTrialNumber: 1 }),
  new Stop.Request({ mode: "Interrupt", reason: "omega", requestedByTrialNumber: 1 }),
  earliestInterrupt
)

const selectedFrom = (candidates: Chunk.Chunk<Stop.Request>) =>
  Effect.gen(function*() {
    const ref = yield* Stop.make
    yield* Effect.forEach(candidates, (candidate) => Stop.request(ref, candidate), { discard: true })
    return yield* Ref.get(ref)
  })

it.effect("selects requests independently of arrival order", () =>
  Effect.gen(function*() {
    expect(yield* selectedFrom(requests)).toEqual(Option.some(earliestInterrupt))
    expect(yield* selectedFrom(Chunk.reverse(requests))).toEqual(Option.some(earliestInterrupt))
  }))

it.effect("reports only changes to the selected request", () =>
  Effect.gen(function*() {
    const ref = yield* Stop.make

    expect(yield* Stop.request(ref, earliestInterrupt)).toEqual(Option.some(earliestInterrupt))
    expect(yield* Stop.request(ref, earliestInterrupt)).toEqual(Option.none())
    expect(yield* Ref.get(ref)).toEqual(Option.some(earliestInterrupt))
  }))

it.effect("keeps Drain cooperative and exposes Interrupt through polling", () =>
  Effect.gen(function*() {
    const ref = yield* Stop.make
    expect(yield* Stop.heartbeat(ref, "Interrupt")).toEqual(Stop.Continue())

    yield* Stop.request(ref, earliestInterrupt)

    expect(yield* Stop.heartbeat(ref, "Drain")).toEqual(Stop.Continue())
    expect(yield* Stop.heartbeat(ref, "Interrupt")).toEqual(
      Stop.Stop({ mode: "Interrupt", reason: "alpha" })
    )
  }))
