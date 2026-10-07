/** DSP-shaped observations without a DSP dependency or built-in grading policy. */
import { BunRuntime } from "@effect/platform-bun"
import { Evaluation, History } from "@scenesystems/effect-study"
import { Array as Arr, Effect, Match, Schema } from "effect"

const Input = Schema.Struct({ question: Schema.String, expected: Schema.String })
const Prediction = Schema.Struct({ answer: Schema.String, rationale: Schema.String })
class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", { detail: Schema.String }) {}

// A local fixture stands in for a producer's Effect; Study does not run a model.
const predict = (input: typeof Input.Type) =>
  input.question === "unavailable"
    ? Effect.fail(new Unavailable({ detail: "producer unavailable" }))
    : Effect.succeed(Prediction.make({ answer: "41", rationale: "a completed, potentially incorrect answer" }))

const program = Effect.gen(function*() {
  const trials = yield* Evaluation.runSettled(
    Arr.make(
      Input.make({ question: "What is six times seven?", expected: "42" }),
      Input.make({ question: "unavailable", expected: "42" })
    ),
    predict
  )
  const inspected = Arr.map(trials, (trial) =>
    Match.value(trial.state).pipe(
      Match.tag(
        "Completed",
        (state) => ({ outcome: state._tag, correct: state.value.answer === trial.config.expected })
      ),
      Match.tag("Failed", (state) => ({ outcome: state._tag, error: state.error.detail })),
      Match.exhaustive
    ))
  // No cost was reported. Missing cost is not evidence of free execution.
  yield* Effect.log({ inspected, costs: History.costs(History.fromIterable(trials)) })
})

BunRuntime.runMain(program)
