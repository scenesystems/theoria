import type { Registry } from "@effect-atom/atom"
import { Effect } from "effect"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import * as Arr from "effect/Array"

import {
  EffectMathCanonicalStep,
  EffectMathProjectionScript,
  isEffectMathProjectionScript,
  PowerControls,
  PowerProjection
} from "../../app/contracts/capability/effect-math.js"
import {
  effectSearchStudyTelemetrySections
} from "../../app/contracts/capability/effect-search-study-telemetry-evidence.js"
import {
  projectEffectSearchStudyTelemetry
} from "../../app/contracts/capability/effect-search-study-telemetry-projection.js"
import {
  EffectSearchCanonicalStep,
  isEffectSearchProjectionScript,
  optimizationEvidenceBatchSize,
  SearchConfig,
  type TrialPoint,
  trialPositionsSection
} from "../../app/contracts/capability/effect-search.js"
import {
  EffectTextProjectionStep,
  isEffectTextTraversalScript,
  snapshotEffectTextTraversalScript
} from "../../app/contracts/capability/effect-text.js"
import type { EntryId } from "../../app/contracts/entry/id.js"
import type { EvidenceSection } from "../../app/contracts/evidence/item.js"
import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  type EvidenceEvent,
  SectionAppend,
  SectionUpsert,
  StreamComplete
} from "../../app/contracts/evidence/stream.js"
import {
  computeDistributionGeometry,
  computeInferenceSummary,
  computePowerBySampleSize,
  computePowerCurves,
  computeRequiredNGrid,
  computeSensitivity,
  computeSolverStatus,
  configurationSection
} from "../../app/server/adapters/effect-math/stream.js"
import { surfaceAtom } from "../../app/web/atoms/surface/state.js"
import type { SurfaceState } from "../../app/web/state/surface/state.js"

type EvidenceSource = {
  readonly emitEvidence: (data: string) => void
}

type StreamMeta = {
  readonly requestId: string
  readonly buildSha: string
  readonly durationMs: number
}

type EffectSearchStreamOptions = {
  readonly extraSections?: ReadonlyArray<EvidenceSection>
  readonly includeAnimationSummary?: boolean
  readonly includeComplete?: boolean
  readonly meta: StreamMeta
  readonly stepCount?: number
  readonly summary: string
}

const emitEvent = (source: EvidenceSource, event: EvidenceEvent): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    source.emitEvidence(encodeEvidenceEventJson(event))
  })

const readSurface = (registry: Registry.Registry, id: EntryId): SurfaceState => registry.get(surfaceAtom(id))

const effectTextScriptForSurface = (surface: SurfaceState) => {
  const draft = surface.run.session.draft ?? surface.draft

  return isEffectTextTraversalScript(surface.run.session.localProjectionScript)
    ? surface.run.session.localProjectionScript
    : draft.entryId === "effect-text"
    ? snapshotEffectTextTraversalScript({
      customText: draft.input.customText,
      viewportWidthPx: draft.input.viewportWidthPx
    })
    : null
}

const effectMathScriptForSurface = (surface: SurfaceState) => {
  const draft = surface.run.session.draft ?? surface.draft

  return isEffectMathProjectionScript(surface.run.session.localProjectionScript)
    ? surface.run.session.localProjectionScript
    : draft.entryId === "effect-math"
    ? EffectMathProjectionScript.fromControls(PowerControls.make(draft.input))
    : null
}

const effectSearchScriptForSurface = (surface: SurfaceState) => {
  const draft = surface.run.session.draft ?? surface.draft

  return isEffectSearchProjectionScript(surface.run.session.localProjectionScript)
    ? surface.run.session.localProjectionScript
    : draft.entryId === "effect-search"
    ? SearchConfig.fromTrialBudget(draft.input.trialBudget).projectionScript()
    : null
}

const uniqueStageWidths = (widths: ReadonlyArray<number>): ReadonlyArray<number> =>
  widths.reduce<ReadonlyArray<number>>(
    (acc, width) => (acc.includes(width) ? acc : [...acc, width]),
    []
  )

const tpeTrialPoint = (index: number): TrialPoint => ({
  index,
  x: 2 - (index * 0.1),
  y: -1 + (index * 0.05),
  value: Math.max(0.05, 4 / (index + 1))
})

const randomTrialPoint = (index: number): TrialPoint => ({
  index,
  x: -4 + (index * 0.25),
  y: 4 - (index * 0.2),
  value: 6 - Math.min(index * 0.2, 3)
})

const studyEventsForTrialPoints = ({
  includeComplete,
  points
}: {
  readonly includeComplete: boolean
  readonly points: ReadonlyArray<TrialPoint>
}) => {
  const baseEvents = points.reduce<{
    readonly bestValue: number | null
    readonly events: ReadonlyArray<SearchStudyEvent.StudyEvent>
  }>(
    (state, point) => {
      const nextEvents = [
        ...state.events,
        SearchStudyEvent.TrialStarted.make({
          trialNumber: point.index,
          config: { x: point.x, y: point.y }
        }),
        SearchStudyEvent.TrialCompleted.make({
          trialNumber: point.index,
          value: point.value
        })
      ]

      return state.bestValue === null || point.value < state.bestValue
        ? {
          bestValue: point.value,
          events: [
            ...nextEvents,
            SearchStudyEvent.BestUpdated.make({
              trialNumber: point.index,
              value: point.value
            })
          ]
        }
        : {
          bestValue: state.bestValue,
          events: nextEvents
        }
    },
    { bestValue: null, events: [] }
  ).events

  return includeComplete
    ? [
      ...baseEvents,
      SearchStudyEvent.StudyCompleted.make({ completionReason: "budgetExhausted" })
    ]
    : baseEvents
}

export const emitEffectTextAuthoredStream = ({
  meta,
  registry,
  source,
  summary
}: {
  readonly meta: StreamMeta
  readonly registry: Registry.Registry
  readonly source: EvidenceSource
  readonly summary: string
}): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const script = effectTextScriptForSurface(readSurface(registry, "effect-text"))

    if (script === null) {
      return yield* Effect.die("missing-effect-text-projection-script")
    }

    const projectionSteps = script.entries.flatMap((entry) =>
      entry.steps.map((planStep) =>
        new EffectTextProjectionStep({
          corpusIndex: entry.corpusIndex,
          requestedWidthPx: planStep.requestedWidthPx,
          stageWidthPx: planStep.stageWidthPx,
          obstaclesEnabled: planStep.obstaclesEnabled
        })
      )
    )
    const stageWidths = uniqueStageWidths(
      script.entries.flatMap((entry) => entry.steps.map((step) => step.stageWidthPx))
    )

    yield* Effect.forEach(projectionSteps, (nextStep) => emitEvent(source, canonicalStepEvent(nextStep)), {
      discard: true
    })
    yield* emitEvent(
      source,
      new SectionAppend({
        section: {
          title: "Performance",
          items: [{
            _tag: "Text",
            label: "Proof",
            value: "Server-authored projection widths streamed under one frozen projection script."
          }]
        }
      })
    )
    yield* emitEvent(
      source,
      new SectionAppend({
        section: {
          title: "Width Metrics",
          items: stageWidths.map((width) => ({
            _tag: "Text",
            label: `Width ${width}`,
            value: `${width} measured / ${width} naive (MAE 0.0000)`
          }))
        }
      })
    )
    yield* emitEvent(source, StreamComplete.make({ summary, meta }))
  }).pipe(Effect.orDie)

export const emitEffectMathAuthoredStream = ({
  meta,
  registry,
  source,
  summary
}: {
  readonly meta: StreamMeta
  readonly registry: Registry.Registry
  readonly source: EvidenceSource
  readonly summary: string
}): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const script = effectMathScriptForSurface(readSurface(registry, "effect-math"))

    if (script === null) {
      return yield* Effect.die("missing-effect-math-projection-script")
    }

    const request = { controls: script.baseControls }
    const sections: ReadonlyArray<EvidenceSection> = yield* Effect.all([
      computeSensitivity(request),
      computePowerBySampleSize(request),
      computeRequiredNGrid,
      computePowerCurves(request),
      computeDistributionGeometry(request),
      computeInferenceSummary(request),
      computeSolverStatus(request),
      Effect.succeed(configurationSection(request))
    ])

    yield* Effect.forEach(
      script.phases.flatMap((phase) => phase.steps),
      (controls) =>
        emitEvent(
          source,
          canonicalStepEvent(
            new EffectMathCanonicalStep({
              controls,
              projection: PowerProjection.project(controls)
            })
          )
        ),
      { discard: true }
    )

    yield* Effect.forEach(
      sections,
      (section) => emitEvent(source, new SectionAppend({ section })),
      { discard: true }
    )

    yield* emitEvent(
      source,
      new SectionAppend({
        section: {
          title: "Runtime Summary",
          items: [{ _tag: "Text", label: "Proof", value: "Server-authored power sweep emitted every canonical frame." }]
        }
      })
    )
    yield* emitEvent(source, StreamComplete.make({ summary, meta }))
  }).pipe(Effect.orDie)

export const emitEffectSearchAuthoredStream = ({
  extraSections = [],
  includeAnimationSummary = true,
  includeComplete = true,
  meta,
  registry,
  source,
  stepCount,
  summary
}: EffectSearchStreamOptions & {
  readonly registry: Registry.Registry
  readonly source: EvidenceSource
}): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const script = effectSearchScriptForSurface(readSurface(registry, "effect-search"))

    if (script === null) {
      return yield* Effect.die("missing-effect-search-projection-script")
    }

    const trialBudget = script.trialBudget
    const totalSteps = Math.min(stepCount ?? trialBudget, trialBudget)
    const indices = Arr.range(0, totalSteps - 1)

    yield* Effect.forEach(indices, (index) => {
      const currentTpeTrials = Arr.range(0, index).map(tpeTrialPoint)
      const currentRandomTrials = Arr.range(0, index).map(randomTrialPoint)
      const isTerminalFrame = index + 1 === trialBudget && totalSteps === trialBudget
      const telemetry = projectEffectSearchStudyTelemetry({
        randomEvents: studyEventsForTrialPoints({ includeComplete: isTerminalFrame, points: currentRandomTrials }),
        randomTrialPoints: currentRandomTrials,
        trialBudget,
        tpeEvents: studyEventsForTrialPoints({ includeComplete: isTerminalFrame, points: currentTpeTrials }),
        tpeTrialPoints: currentTpeTrials
      })

      return emitEvent(
        source,
        canonicalStepEvent(
          EffectSearchCanonicalStep.make({
            trialBudget,
            phase: isTerminalFrame ? "complete" : "running",
            tpeTrials: currentTpeTrials,
            randomTrials: currentRandomTrials,
            telemetry
          })
        )
      ).pipe(
        Effect.zipRight(
          index === 0 || (index + 1) % optimizationEvidenceBatchSize === 0 || index + 1 === totalSteps
            ? emitEvent(
              source,
              new SectionUpsert({
                section: trialPositionsSection({
                  force: isTerminalFrame,
                  randomPoints: currentRandomTrials,
                  tpePoints: currentTpeTrials
                })
              })
            ).pipe(
              Effect.zipRight(
                Effect.forEach(
                  effectSearchStudyTelemetrySections(telemetry),
                  (nextSection) => emitEvent(source, new SectionUpsert({ section: nextSection })),
                  { discard: true }
                )
              )
            )
            : Effect.void
        )
      )
    }, { discard: true })

    yield* Effect.forEach(extraSections, (section) => emitEvent(source, new SectionAppend({ section })), {
      discard: true
    })

    if (includeAnimationSummary) {
      yield* emitEvent(
        source,
        new SectionAppend({
          section: {
            title: "Runtime Summary",
            items: [{
              _tag: "Text",
              label: "Proof",
              value: "Server-authored study checkpoints were projected without app-local reconstruction."
            }]
          }
        })
      )
    }

    if (includeComplete) {
      yield* emitEvent(source, StreamComplete.make({ summary, meta }))
    }
  }).pipe(Effect.orDie)
