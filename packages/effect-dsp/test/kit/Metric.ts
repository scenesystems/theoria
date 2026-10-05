import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Array as Arr, Data, Effect, Number as Num, Record, Ref, Schema } from "effect"

export class ScriptedFailure extends Data.TaggedError("ScriptedFailure")<{ readonly id: string }> {}
const Identity = Schema.Struct({ id: Schema.String })

export const countingMetric = Effect.fnUntraced(function*<E, R, A>(metric: Metric.Metric<E, R, A>) {
  const calls = yield* Ref.make(0)
  return {
    calls,
    metric: new Metric.Metric({
      name: metric.name,
      score: (prediction: A, expected: A) =>
        Ref.update(calls, Num.increment).pipe(Effect.andThen(metric.score(prediction, expected)))
    })
  }
})

export const scriptedMetric = (byExampleId: Readonly<Record<string, number>>) =>
  Metric.fromEffect("scripted", (_prediction: unknown, expected: unknown) =>
    Effect.gen(function*() {
      const { id } = yield* Schema.decodeUnknownEffect(Identity)(expected)
      const score = yield* Effect.fromOption(Record.get(byExampleId, id), () => new ScriptedFailure({ id }))
      return new Metric.Result({ score })
    }))

export const failingOn = (ids: ReadonlyArray<string>) =>
  Metric.fromEffect("failingOn", (_prediction: unknown, expected: unknown) =>
    Effect.gen(function*() {
      const { id } = yield* Schema.decodeUnknownEffect(Identity)(expected)
      if (Arr.contains(ids, id)) return yield* new ScriptedFailure({ id })
      return new Metric.Result({ score: 1 })
    }))
