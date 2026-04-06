import { Effect, Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

import { Example, Metric, Module, Signature } from "effect-dsp"

import type { DspModuleType, DspScenarioDefinition, DspScenarioId } from "../../../contracts/demo/dsp.js"
import { scenarioById } from "../../../contracts/demo/dsp.js"

import { DspProviderRuntime, DspProviderUnavailable } from "./provider.js"

export const buildSignatureAndModule = (scenario: DspScenarioDefinition, moduleType: DspModuleType) =>
  Effect.gen(function*() {
    const inputFields = Record.fromEntries(
      Arr.map(
        scenario.contract.inputFields,
        (field) => [field.name, Signature.describe(Schema.String, field.description)]
      )
    )
    const outputFields = Record.fromEntries(
      Arr.map(
        scenario.contract.outputFields,
        (field) => [field.name, Signature.describe(Schema.String, field.description)]
      )
    )
    const signature = yield* Signature.make(scenario.contract.instruction, inputFields, outputFields)

    return yield* Match.value(moduleType).pipe(
      Match.when("chainOfThought", () => Module.chainOfThought(`theoria-${scenario.id}-cot`, signature)),
      Match.orElse(() => Module.predict(`theoria-${scenario.id}-predict`, signature))
    )
  })

export const metricForScenario = (scenario: DspScenarioDefinition) =>
  Match.value(scenario.id).pipe(
    Match.when("intervention-classifier", () => Metric.exactMatch("intervention")),
    Match.when("member-check-summary", () => Metric.f1("keyThemes")),
    Match.when("probe-follow-up", () => Metric.exactMatch("probeType")),
    Match.exhaustive
  )

export const resolveProvider = Effect.gen(function*() {
  const runtime = yield* DspProviderRuntime

  const layer = yield* Option.match(runtime.layer, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: Effect.succeed
  })

  const provider = yield* Option.match(runtime.capability.provider, {
    onNone: () =>
      Effect.fail(
        new DspProviderUnavailable({
          message: Option.getOrElse(runtime.capability.reason, () => "DSP provider is not configured.")
        })
      ),
    onSome: Effect.succeed
  })

  return {
    layer,
    provider,
    model: Option.getOrElse(runtime.capability.model, () => "unknown")
  }
})

export const resolveScenario = (scenarioId: DspScenarioId): DspScenarioDefinition => scenarioById(scenarioId)

export const scenarioExamples = (scenario: DspScenarioDefinition): ReadonlyArray<Example.Example> =>
  Arr.map(scenario.examples, (example) => new Example.Example({ input: example.input, output: example.expected }))
