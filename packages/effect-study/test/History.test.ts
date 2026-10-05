import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, pipe, Schema } from "effect"

import * as History from "@scenesystems/effect-study/History"
import * as Trial from "@scenesystems/effect-study/Trial"

const Record = Trial.Trial(Schema.String, Trial.Completed(Schema.String))
const trial = (trialNumber: number, cost: Option.Option<number>): typeof Record.Type => ({
  trialNumber,
  config: "input",
  state: { _tag: "Completed", value: "observed", duration: 12 },
  ...Option.match(cost, { onNone: () => ({}), onSome: (cost) => ({ cost }) })
})

it.effect("orders restored trials and counts each trial's latest cost once", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(4, Option.some(9)),
      trial(-1, Option.some(2)),
      trial(4, Option.some(3)),
      trial(2, Option.none())
    ))
    expect(Arr.map(History.values(history), (record) => record.trialNumber)).toEqual(Arr.make(-1, 2, 4))
    expect(history.cumulativeCost).toBe(5)

    const updated = pipe(history, History.set(trial(4, Option.some(7))))
    expect(updated.cumulativeCost).toBe(9)
    expect(History.set(updated, trial(4, Option.some(7))).cumulativeCost).toBe(9)
    expect(history.cumulativeCost).toBe(5)
    expect(History.values(updated).length).toBe(3)
  }))

it.effect("ignores absent, negative, and non-finite costs without losing trials", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(0, Option.some(-5)),
      trial(1, Option.some(Infinity)),
      trial(2, Option.some(NaN)),
      trial(3, Option.some(2.75)),
      trial(4, Option.none())
    ))
    expect(history.cumulativeCost).toBe(2.75)
    expect(History.values(history).length).toBe(5)
    expect(History.set(history, trial(3, Option.none())).cumulativeCost).toBe(0)
  }))

it.effect("reports known zero separately from missing and invalid costs", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(0, Option.some(0)),
      trial(1, Option.some(2.75)),
      trial(2, Option.some(9)),
      trial(3, Option.none()),
      trial(4, Option.some(-5)),
      trial(5, Option.some(Infinity)),
      trial(6, Option.some(-Infinity)),
      trial(7, Option.some(NaN))
    ))
    expect(History.costs(history)).toEqual({ reportedTotal: 11.75, reportedCount: 3, missingCount: 1, invalidCount: 4 })
    expect(History.costs(History.empty())).toEqual({
      reportedTotal: 0,
      reportedCount: 0,
      missingCount: 0,
      invalidCount: 0
    })

    const replaced = history.pipe(
      History.set(trial(2, Option.some(1.25))),
      History.set(trial(3, Option.some(0))),
      History.set(trial(4, Option.none())),
      History.set(trial(0, Option.some(-1)))
    )
    expect(History.costs(replaced)).toEqual({ reportedTotal: 4, reportedCount: 3, missingCount: 1, invalidCount: 4 })
    expect(replaced.cumulativeCost).toBe(4)
    expect(History.costs(History.set(replaced, trial(2, Option.some(1.25))))).toEqual(History.costs(replaced))
  }))

it.effect("retains valid cost counts when the aggregate overflows and recomputes after replacement", () =>
  Effect.gen(function*() {
    const history = History.fromIterable(Arr.make(
      trial(0, Option.some(1e308)),
      trial(1, Option.some(1e308)),
      trial(2, Option.some(0)),
      trial(3, Option.none()),
      trial(4, Option.some(-1))
    ))
    const summary = History.costs(history)
    expect(summary).toEqual({ reportedTotal: "Overflow", reportedCount: 3, missingCount: 1, invalidCount: 1 })
    const codec = Schema.fromJsonString(History.Cost)
    expect(yield* Schema.decodeEffect(codec)(yield* Schema.encodeEffect(codec)(summary))).toEqual(summary)
    expect(History.costs(History.set(history, trial(1, Option.some(3))))).toEqual({
      reportedTotal: 1e308,
      reportedCount: 3,
      missingCount: 1,
      invalidCount: 1
    })
  }))
