import { Effect } from "effect"
import * as Arr from "effect/Array"

export const averageMilliseconds = (durations: ReadonlyArray<number>): number =>
  durations.length === 0 ? 0 : Arr.reduce(durations, 0, (total, duration) => total + duration) / durations.length

export const maximumValue = (values: ReadonlyArray<number>): number =>
  Arr.match(values, {
    onEmpty: () => 0,
    onNonEmpty: (nonEmpty) =>
      Arr.reduce(nonEmpty, Arr.headNonEmpty(nonEmpty), (current, value) => value > current ? value : current)
  })

export const minimumValue = (values: ReadonlyArray<number>): number =>
  Arr.match(values, {
    onEmpty: () => 0,
    onNonEmpty: (nonEmpty) =>
      Arr.reduce(nonEmpty, Arr.headNonEmpty(nonEmpty), (current, value) => value < current ? value : current)
  })

export const measureMilliseconds = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const startedAt = yield* Effect.sync(() => performance.now())
    const value = yield* effect
    const endedAt = yield* Effect.sync(() => performance.now())

    return {
      value,
      durationMs: endedAt - startedAt
    }
  })
