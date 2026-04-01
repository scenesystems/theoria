import { Clock, Effect, Match, Option, Schema } from "effect"

import { Module, Signature } from "effect-dsp"
import type { Program } from "../../../contracts/presentation.js"
import type { RunData } from "../../../contracts/run.js"

import { executableProgram } from "../program-source.js"
import { DspProviderRuntime, DspProviderUnavailable } from "./provider.js"

export const preloadProgram: Effect.Effect<Program, unknown, never> = executableProgram(import.meta.url)

const expectedLabel = "positive"
const signatureInstruction = "Classify short sentiment text"
const inputFieldNames = ["text"]
const outputFieldNames = ["label"]

const normalizeLabel = (value: string): string => value.trim().toLowerCase()

const heuristicLabel = (text: string): string =>
  Match.value(text.toLowerCase()).pipe(
    Match.when((value) => value.includes("hate"), () => "negative"),
    Match.when((value) => value.includes("love"), () => "positive"),
    Match.orElse(() => "neutral")
  )

const correctness = (candidate: string): boolean => normalizeLabel(candidate).includes(expectedLabel)

export const run: Effect.Effect<
  RunData,
  DspProviderUnavailable | unknown,
  DspProviderRuntime
> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const runtime = yield* DspProviderRuntime

  const layer = yield* Option.match(runtime.layer, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: (modelLayer) => Effect.succeed(modelLayer)
  })

  const provider = yield* Option.match(runtime.capability.provider, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: (providerLabel) => Effect.succeed(providerLabel)
  })
  const model = Option.getOrElse(runtime.capability.model, () => "unknown")

  const input = "I expected to hate this migration, but typed envelopes made incident response dramatically calmer."

  const classifierSignature = yield* Signature.make(
    signatureInstruction,
    {
      text: Signature.describe(Schema.String, "Text to classify")
    },
    {
      label: Signature.describe(Schema.String, "Sentiment label")
    }
  )

  const classifier = yield* Module.predict("theoria-live-classifier", classifierSignature)

  const result = yield* classifier.forward({ text: input }).pipe(Effect.provide(layer))
  const modelLabel = normalizeLabel(result.label)
  const heuristic = heuristicLabel(input)
  const modelCorrect = correctness(modelLabel)
  const heuristicCorrect = correctness(heuristic)
  const runnableProgram = yield* preloadProgram
  const responseFieldCount = outputFieldNames.length

  const endedAt = yield* Clock.currentTimeMillis

  return {
    id: "effect-dsp",
    packageName: "effect-dsp",
    summary: "effect-dsp ran a provider-backed typed classifier and compared it with a naive heuristic.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      {
        title: "Classification",
        items: [
          { _tag: "Text", label: "Input", value: input },
          { _tag: "Text", label: "Expected label", value: expectedLabel },
          {
            _tag: "Text",
            label: "Heuristic label",
            value: `${heuristic} (${heuristicCorrect ? "correct" : "incorrect"})`
          },
          { _tag: "Text", label: "Model label", value: `${modelLabel} (${modelCorrect ? "correct" : "incorrect"})` },
          {
            _tag: "Comparison",
            label: "Label correctness",
            baseline: heuristicCorrect ? 1 : 0,
            improved: modelCorrect ? 1 : 0,
            unit: "correct",
            direction: "higher-is-better"
          }
        ]
      },
      {
        title: "Signature",
        items: [
          { _tag: "Text", label: "Instruction", value: signatureInstruction },
          { _tag: "Text", label: "Input fields", value: inputFieldNames.join(", ") },
          { _tag: "Text", label: "Output fields", value: outputFieldNames.join(", ") },
          {
            _tag: "Scalar",
            label: "Response field count",
            value: responseFieldCount,
            unit: "fields",
            format: "integer"
          }
        ]
      },
      {
        title: "Provider",
        items: [
          { _tag: "Text", label: "Model", value: model },
          { _tag: "Text", label: "Provider", value: provider }
        ]
      }
    ]
  }
})
