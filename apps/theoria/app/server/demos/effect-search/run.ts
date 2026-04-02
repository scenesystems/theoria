import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Stream } from "effect"

import { Sampler } from "effect-search"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import type { RunData } from "../../../contracts/run.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"
import { sectionEffectsToStream, sectionsToElements } from "../stream-element.js"

import {
  bestHistory,
  defaultSamplerSeed,
  defaultTrialBudget,
  distanceToOptimum,
  gain,
  gainPercent,
  objectiveExpression,
  searchBounds
} from "../../../contracts/demo/objective.js"
import { minimizeWith } from "./objective.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram }

type EffectSearchStreamRequest = {
  readonly trialBudget: number
}

const defaultEffectSearchStreamRequest: EffectSearchStreamRequest = {
  trialBudget: defaultTrialBudget
}

const requestFromManifest = (manifest: StreamManifest | null): EffectSearchStreamRequest =>
  manifest !== null && manifest._tag === "effect-search"
    ? { trialBudget: manifest.trialBudget }
    : defaultEffectSearchStreamRequest

const configurationSection = (request: EffectSearchStreamRequest): EvidenceSection => ({
  title: "Configuration",
  items: [
    { _tag: "Scalar", label: "Trials per sampler", value: request.trialBudget, unit: "trials", format: "integer" },
    { _tag: "Scalar", label: "Sampler seed", value: defaultSamplerSeed, unit: "seed", format: "integer" },
    { _tag: "Text", label: "X range", value: `[${searchBounds.xMin}, ${searchBounds.xMax}]` },
    { _tag: "Text", label: "Y range", value: `[${searchBounds.yMin}, ${searchBounds.yMax}]` }
  ]
})

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis
  const tpe = yield* minimizeWith(Sampler.tpe({ seed: defaultSamplerSeed }))
  const random = yield* minimizeWith(Sampler.random({ seed: defaultSamplerSeed }))
  const tpeBestValue = tpe.bestTrial.state.value
  const randomBestValue = random.bestTrial.state.value
  const absoluteGain = gain(randomBestValue, tpeBestValue)
  const percentGain = gainPercent(randomBestValue, tpeBestValue)
  const tpeDistanceToOptimum = distanceToOptimum(tpe.bestTrial.config)
  const randomDistanceToOptimum = distanceToOptimum(random.bestTrial.config)
  const tpeBestHistory = bestHistory(tpe.trials)
  const randomBestHistory = bestHistory(random.trials)
  const runnableProgram = yield* preloadProgram

  const endedAt = yield* Clock.currentTimeMillis

  return {
    id: "effect-search",
    packageName: "effect-search",
    summary: "effect-search compared adaptive TPE against random search under fixed budget.",
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [
      {
        title: "Optimization Results",
        items: [
          { _tag: "Text", label: "Objective", value: objectiveExpression },
          {
            _tag: "Comparison",
            label: "Best objective value",
            baseline: randomBestValue,
            improved: tpeBestValue,
            unit: "loss",
            direction: "lower-is-better"
          },
          {
            _tag: "Comparison",
            label: "Distance to optimum",
            baseline: randomDistanceToOptimum,
            improved: tpeDistanceToOptimum,
            unit: "distance",
            direction: "lower-is-better"
          },
          { _tag: "Scalar", label: "Absolute gain", value: absoluteGain, unit: "loss", format: "fixed" },
          { _tag: "Scalar", label: "Percent gain", value: percentGain, unit: "%", format: "fixed" }
        ]
      },
      {
        title: "Best Configurations",
        items: [
          {
            _tag: "Text",
            label: "TPE best",
            value: `x=${tpe.bestTrial.config.x.toFixed(4)}, y=${tpe.bestTrial.config.y.toFixed(4)}`
          },
          {
            _tag: "Text",
            label: "Random best",
            value: `x=${random.bestTrial.config.x.toFixed(4)}, y=${random.bestTrial.config.y.toFixed(4)}`
          }
        ]
      },
      {
        title: "Convergence",
        items: [
          { _tag: "Series", label: "TPE convergence", values: tpeBestHistory, unit: "loss", role: "convergence" },
          { _tag: "Series", label: "Random convergence", values: randomBestHistory, unit: "loss", role: "convergence" }
        ]
      },
      {
        title: "Configuration",
        items: [
          { _tag: "Scalar", label: "Trials per sampler", value: tpe.trials.length, unit: "trials", format: "integer" },
          { _tag: "Scalar", label: "Sampler seed", value: defaultSamplerSeed, unit: "seed", format: "integer" },
          { _tag: "Text", label: "X range", value: `[${searchBounds.xMin}, ${searchBounds.xMax}]` },
          { _tag: "Text", label: "Y range", value: `[${searchBounds.yMin}, ${searchBounds.yMax}]` }
        ]
      }
    ]
  }
})

export const streamSections = (request: EffectSearchStreamRequest): Stream.Stream<EvidenceSection, unknown, never> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const getTpe = yield* Effect.cached(minimizeWith(Sampler.tpe({ seed: defaultSamplerSeed }), request.trialBudget))
      const getRandom = yield* Effect.cached(
        minimizeWith(Sampler.random({ seed: defaultSamplerSeed }), request.trialBudget)
      )

      return sectionEffectsToStream([
        Effect.succeed(configurationSection(request)),
        getTpe.pipe(
          Effect.map((tpe): EvidenceSection => ({
            title: "TPE Convergence",
            items: [
              { _tag: "Text", label: "Objective", value: objectiveExpression },
              {
                _tag: "Text",
                label: "Best configuration",
                value: `x=${tpe.bestTrial.config.x.toFixed(4)}, y=${tpe.bestTrial.config.y.toFixed(4)}`
              },
              { _tag: "Scalar", label: "Trials", value: tpe.trials.length, unit: "trials", format: "integer" },
              {
                _tag: "Scalar",
                label: "Distance to optimum",
                value: distanceToOptimum(tpe.bestTrial.config),
                unit: "distance",
                format: "fixed"
              },
              {
                _tag: "Series",
                label: "TPE convergence",
                values: bestHistory(tpe.trials),
                unit: "loss",
                role: "convergence"
              }
            ]
          }))
        ),
        getRandom.pipe(
          Effect.map((random): EvidenceSection => ({
            title: "Random Search",
            items: [
              { _tag: "Text", label: "Objective", value: objectiveExpression },
              {
                _tag: "Text",
                label: "Best configuration",
                value: `x=${random.bestTrial.config.x.toFixed(4)}, y=${random.bestTrial.config.y.toFixed(4)}`
              },
              { _tag: "Scalar", label: "Trials", value: random.trials.length, unit: "trials", format: "integer" },
              {
                _tag: "Scalar",
                label: "Distance to optimum",
                value: distanceToOptimum(random.bestTrial.config),
                unit: "distance",
                format: "fixed"
              },
              {
                _tag: "Series",
                label: "Random convergence",
                values: bestHistory(random.trials),
                unit: "loss",
                role: "convergence"
              }
            ]
          }))
        ),
        Effect.all([getTpe, getRandom]).pipe(
          Effect.map(([tpe, random]): EvidenceSection => {
            const tpeBestValue = tpe.bestTrial.state.value
            const randomBestValue = random.bestTrial.state.value

            return {
              title: "Optimization Results",
              items: [
                {
                  _tag: "Comparison",
                  label: "Best objective value",
                  baseline: randomBestValue,
                  improved: tpeBestValue,
                  unit: "loss",
                  direction: "lower-is-better"
                },
                {
                  _tag: "Comparison",
                  label: "Distance to optimum",
                  baseline: distanceToOptimum(random.bestTrial.config),
                  improved: distanceToOptimum(tpe.bestTrial.config),
                  unit: "distance",
                  direction: "lower-is-better"
                },
                {
                  _tag: "Scalar",
                  label: "Absolute gain",
                  value: gain(randomBestValue, tpeBestValue),
                  unit: "loss",
                  format: "fixed"
                },
                {
                  _tag: "Scalar",
                  label: "Percent gain",
                  value: gainPercent(randomBestValue, tpeBestValue),
                  unit: "%",
                  format: "fixed"
                }
              ]
            }
          })
        )
      ])
    })
  )

export const streamElements = (manifest: StreamManifest | null) =>
  sectionsToElements(streamSections(requestFromManifest(manifest)))
