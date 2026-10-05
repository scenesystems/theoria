import { Example, id } from "@scenesystems/effect-dsp/Example"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Prediction } from "@scenesystems/effect-dsp/Prediction"
import * as Trace from "@scenesystems/effect-dsp/Trace"
import { Array as Arr, Chunk, Data, Effect, Number as Num, Option, Record, Ref } from "effect"

export class ScriptedFailure extends Data.TaggedError("ScriptedFailure")<{ readonly id: string }> {}

export const countingMetric = Effect.fnUntraced(function*<E, R>(metric: Metric.Metric<E, R>) {
  const calls = yield* Ref.make(0)
  return {
    calls,
    metric: new Metric.Metric({
      name: metric.name,
      score: (example, prediction, context) =>
        Ref.update(calls, Num.increment).pipe(Effect.andThen(metric.score(example, prediction, context)))
    })
  }
})

export const scriptedMetric = (byExampleId: Readonly<Record<string, number>>) =>
  Metric.withFeedback((example) =>
    Effect.gen(function*() {
      const identity = yield* id(example)
      const value = yield* Effect.fromOption(Record.get(byExampleId, identity), () =>
        new ScriptedFailure({ id: identity }))
      return new Metric.Score({ value, feedback: Option.none() })
    }), "scripted")

export const failingOn = (ids: ReadonlyArray<string>) =>
  Metric.withFeedback((example) =>
    Effect.gen(function*() {
      const identity = yield* id(example)
      if (Arr.contains(ids, identity)) return yield* new ScriptedFailure({ id: identity })
      return new Metric.Score({ value: 1, feedback: Option.none() })
    }), "failingOn")

/** Unit-test scoring without executing a language model. */
export const score = <E, R>(
  metric: Metric.Metric<E, R>,
  labels: Record.ReadonlyRecord<string, unknown>,
  output: unknown
) => {
  const trace = new Trace.Program({ selected: Chunk.empty(), attempts: Chunk.empty(), usage: Trace.emptyUsage })
  return metric.score(
    new Example({ input: {}, labels: Option.some(labels) }),
    new Prediction({ output, trace, usage: trace.usage }),
    new Metric.Context({ phase: "evaluate", trace: Option.some(trace), target: Option.none() })
  )
}
