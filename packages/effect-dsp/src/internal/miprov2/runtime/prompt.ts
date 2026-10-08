/** Grounding calls and plain-text proposer prompts. @internal */
import type * as Settings from "@scenesystems/effect-lm/ModelSettings"
import {
  Array as Arr,
  Boolean as Bool,
  Effect,
  Inspectable,
  Number as Num,
  Option,
  Record,
  String as Str
} from "effect"
import type { Example } from "../../../Example.js"
import { RolloutRef } from "../../cache/rollout.js"
import { CurrentRole } from "../../modelRole.js"
import { generateText } from "../../module/textGeneration.js"
import { stripPrefix } from "./policy.js"

const objectives = {
  observations:
    "Given several examples from a dataset please write observations about trends that hold for most or all of the samples. Some areas you may consider in your observations: topics, content, syntax, conciseness, etc. It will be useful to make an educated guess as to the nature of the task this dataset will enable. Don't be afraid to be creative",
  summary:
    "Given a series of observations I have made about my dataset, please summarize them into a brief 2-3 sentence summary which highlights only the most important details.",
  program_description:
    "Below is a declarative structure for a pipeline that solves tasks with calls to language models. Please describe what type of task this program appears to be designed to solve, and how it appears to work.",
  module_description:
    "Below is a declarative structure for a pipeline that solves tasks with calls to language models. Please describe the purpose of the specified module in this pipeline.",
  proposed_instruction:
    "Use the information below to learn about a task that we are trying to solve using calls to an LM, then generate a new instruction that will be used to prompt a Language Model to better solve the task."
}

export const prompt = (fields: Record.ReadonlyRecord<string, string>, output: keyof typeof objectives) =>
  Arr.join(
    Arr.prepend(
      Arr.append(Arr.map(Record.toEntries(fields), ([key, value]) => `${key}:\n${value}`), `Return only ${output}.`),
      `${objectives[output]}${
        Bool.match(Record.has(fields, "prior_observations"), {
          onFalse: () => "",
          onTrue: () =>
            " I will also provide you with a few observations I have already made. Please add your own observations or if you feel the observations are comprehensive say 'COMPLETE'."
        })
      }`
    ),
    "\n\n"
  )

export const generate = (text: string, settings: Settings.ModelSettings) =>
  generateText(text, settings).pipe(Effect.provideService(CurrentRole, "proposer"))

export const datasetSummary = (
  trainset: ReadonlyArray<Example>,
  batchSize: number,
  settings: Settings.ModelSettings
) =>
  Effect.gen(function*() {
    const describe = (examples: ReadonlyArray<Example>, prior: Option.Option<string>) =>
      Effect.gen(function*() {
        const fields = {
          ...Option.match(prior, {
            onNone: () => ({}),
            onSome: (observations) => ({ prior_observations: observations })
          }),
          examples: Inspectable.toStringUnknown(examples)
        }
        return yield* generate(prompt(fields, "observations"), settings)
      })
    const first = yield* describe(Arr.take(trainset, batchSize), Option.none())
    // At most ten descriptors total; COMPLETE skips accumulate rather than reset.
    const batches = Arr.take(Arr.chunksOf(Arr.drop(trainset, batchSize), batchSize), 9)
    const result = yield* Effect.reduce(
      batches,
      () => ({ observations: first, skips: 0, stopped: false }),
      (state, batch) =>
        Bool.match(state.stopped || Num.isGreaterThanOrEqualTo(state.skips, 5), {
          onTrue: () => Effect.succeed(state),
          onFalse: () =>
            describe(batch, Option.some(state.observations)).pipe(
              Effect.option,
              Effect.map(Option.match({
                onNone: () => ({ ...state, stopped: true }),
                onSome: (value) =>
                  Bool.match(Str.startsWith("COMPLETE")(Str.toUpperCase(value)), {
                    onFalse: () => ({ ...state, observations: Str.concat(state.observations, value) }),
                    onTrue: () => ({ ...state, skips: Num.increment(state.skips) })
                  })
              }))
            )
        })
    )
    return stripPrefix(yield* generate(prompt({ observations: result.observations }, "summary"), settings))
  }).pipe(Effect.provideService(RolloutRef, Option.none()))
