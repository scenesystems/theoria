import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Deferred, Stream } from "effect"
import { Clock, Effect, Queue } from "effect"
import { Study } from "effect-search"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type { CanonicalStep } from "../../contracts/canonical-step.js"
import type { EffectTextProjectionStep } from "../../contracts/canonical-step.js"
import { corpus } from "../../contracts/corpus.js"
import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { EffectTextRunPlan } from "../../contracts/demo/text.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { SectionAppend, SectionUpsert } from "../../contracts/evidence-stream.js"
import type { EvidenceItem } from "../../contracts/evidence.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  prepareReflowEntry,
  projectReflowProjection,
  reflowControlsAtom,
  reflowSliderMaxWidth,
  resolveReflowCorpusEntry
} from "./reflow.js"
import { awaitNextRunSignalChange, awaitRunSignal, type RunSignal, sleepWithRunSignal } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

export const animatingAtom: AtomType.Writable<boolean> = Atom.make(false)

const defaultReflowWidth = Math.round(reflowSliderMaxWidth / 2)
const stepDelayMs = 10
const corpusPauseMs = 96
const obstaclePauseMs = 120

type StreamCompletionEvent = Extract<EvidenceEvent, { readonly _tag: "StreamComplete" }>

const executionFailedError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message,
    retryable: true
  })

type EffectTextAnimationEvent = EvidenceEvent | {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: EffectTextRunFrame
}

type TrialAccumulator = {
  readonly rows: ReadonlyArray<TrialRow>
  readonly index: number
}

const initialTrialAccumulator: TrialAccumulator = {
  rows: [],
  index: 0
}

type TrialRow = {
  readonly corpusLabel: string
  readonly width: number
  readonly obstacles: boolean
  readonly lineCount: number
  readonly height: number
  readonly maxLineWidth: number
}

const trialColumns: ReadonlyArray<string> = [
  "Corpus",
  "Width",
  "Obstacles",
  "Lines",
  "Height (px)",
  "Max Line Width (px)"
]

const rowToStrings = (row: TrialRow): ReadonlyArray<string> => [
  row.corpusLabel,
  String(row.width),
  row.obstacles ? "yes" : "no",
  String(row.lineCount),
  row.height.toFixed(1),
  row.maxLineWidth.toFixed(1)
]

const makeTrialTable = (
  label: string,
  rows: ReadonlyArray<TrialRow>
): EvidenceItem => ({
  _tag: "Table",
  label,
  columns: trialColumns,
  rows: Arr.map(rows, rowToStrings)
})

const upsertProjectionSection = ({
  emit,
  label,
  rows
}: {
  readonly emit: (event: EffectTextAnimationEvent) => Effect.Effect<void, never, never>
  readonly label: string
  readonly rows: ReadonlyArray<TrialRow>
}): Effect.Effect<void, never, never> =>
  emit(
    new SectionUpsert({
      section: {
        title: `${label} — live projections`,
        items: [makeTrialTable(`${label} projection matrix`, rows)]
      }
    })
  )

const emitFrameUpdate = ({
  emit,
  frame
}: {
  readonly emit: (event: EffectTextAnimationEvent) => Effect.Effect<void, never, never>
  readonly frame: EffectTextRunFrame
}): Effect.Effect<void, never, never> =>
  emit({
    _tag: "LocalRunFrameUpdated",
    frame
  })

export const setAnimationPlayback = (
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(animatingAtom, isAnimating)
  })

export const syncAnimationFrameToControls = (
  registry: RunRegistry,
  frame: EffectTextRunFrame
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(reflowControlsAtom, frame.controls)
  })

export const resetAnimationState = (registry: RunRegistry): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    const hasCustomText = registry.get(customTextAtom).trim().length > 0

    registry.set(animatingAtom, false)
    registry.set(reflowControlsAtom, {
      corpusIndex: hasCustomText ? corpus.length : 0,
      width: defaultReflowWidth,
      obstaclesEnabled: false
    })
  })

const takeEffectTextQueueEvent = (
  signal: RunSignal,
  stepQueue: Queue.Queue<CanonicalStep | StreamCompletionEvent>
): Effect.Effect<CanonicalStep | StreamCompletionEvent, never, never> =>
  Effect.raceFirst(
    Queue.take(stepQueue),
    awaitNextRunSignalChange(signal).pipe(
      Effect.zipRight(awaitRunSignal(signal)),
      Effect.flatMap(() => takeEffectTextQueueEvent(signal, stepQueue))
    )
  )

const takeEffectTextProjectionStep = (
  signal: RunSignal,
  stepQueue: Queue.Queue<CanonicalStep | StreamCompletionEvent>
): Effect.Effect<EffectTextProjectionStep, DemoExecutionError, never> =>
  takeEffectTextQueueEvent(signal, stepQueue).pipe(
    Effect.flatMap((step) =>
      step._tag === "StreamComplete"
        ? Effect.fail(
          executionFailedError(
            "effect-text run ended before all authored projection steps arrived."
          )
        )
        : step._tag === "EffectTextProjectionStep"
        ? Effect.succeed(step)
        : takeEffectTextProjectionStep(signal, stepQueue)
    )
  )

const validateAuthoredStep = ({
  authoredStep,
  plannedCorpusIndex,
  plannedStep
}: {
  readonly authoredStep: EffectTextProjectionStep
  readonly plannedCorpusIndex: number
  readonly plannedStep: EffectTextRunPlan["entries"][number]["steps"][number]
}): Effect.Effect<void, DemoExecutionError, never> =>
  authoredStep.corpusIndex === plannedCorpusIndex
    && authoredStep.requestedWidthPx === plannedStep.requestedWidthPx
    && authoredStep.stageWidthPx === plannedStep.stageWidthPx
    && authoredStep.obstaclesEnabled === plannedStep.obstaclesEnabled
    ? Effect.void
    : Effect.fail(
      executionFailedError(
        `effect-text authored step drifted from the frozen run plan (expected corpus=${plannedCorpusIndex}, requestedWidth=${plannedStep.requestedWidthPx}, stageWidth=${plannedStep.stageWidthPx}, obstacles=${plannedStep.obstaclesEnabled}; received corpus=${authoredStep.corpusIndex}, requestedWidth=${authoredStep.requestedWidthPx}, stageWidth=${authoredStep.stageWidthPx}, obstacles=${authoredStep.obstaclesEnabled}).`
      )
    )

export const makeAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectTextRunPlan,
  stepQueue: Queue.Queue<CanonicalStep | StreamCompletionEvent>,
  _serverCompleted: Deferred.Deferred<StreamCompletionEvent>
): Stream.Stream<EffectTextAnimationEvent, DemoExecutionError, never> =>
  Study.streamFromEmitter<EffectTextAnimationEvent, void, DemoExecutionError, never>((emit) =>
    Effect.gen(function*() {
      registry.set(animatingAtom, true)

      const startedAt = yield* Clock.currentTimeMillis
      const frameCount = Arr.reduce(plan.entries, 0, (count, entry) => count + entry.steps.length)

      yield* Effect.forEach(
        plan.entries,
        (planEntry, entryIndex) =>
          Effect.gen(function*() {
            const entry = resolveReflowCorpusEntry(planEntry.corpusIndex, plan.customText)
            const prepared = yield* prepareReflowEntry(entry)

            const trialRows = yield* Effect.reduce(
              planEntry.steps,
              initialTrialAccumulator,
              (acc, plannedStep) =>
                Effect.gen(function*() {
                  yield* awaitRunSignal(signal)
                  const authoredStep = yield* takeEffectTextProjectionStep(signal, stepQueue)
                  yield* validateAuthoredStep({ authoredStep, plannedCorpusIndex: planEntry.corpusIndex, plannedStep })

                  const projection = projectReflowProjection({
                    entry,
                    obstaclesEnabled: plannedStep.obstaclesEnabled,
                    prepared,
                    requestedWidthPx: plannedStep.requestedWidthPx,
                    stageWidthPx: plannedStep.stageWidthPx
                  })
                  const frame: EffectTextRunFrame = {
                    _tag: "effect-text",
                    controls: {
                      corpusIndex: planEntry.corpusIndex,
                      width: plannedStep.stageWidthPx,
                      obstaclesEnabled: plannedStep.obstaclesEnabled
                    },
                    projection
                  }

                  yield* emitFrameUpdate({ emit, frame })

                  yield* sleepWithRunSignal(signal, stepDelayMs)

                  const updatedRows = Arr.append(acc.rows, {
                    corpusLabel: entry.label,
                    width: projection.stageWidthPx,
                    obstacles: plannedStep.obstaclesEnabled,
                    lineCount: projection.summary.lineCount,
                    height: projection.summary.height,
                    maxLineWidth: projection.summary.maxLineWidth
                  })

                  yield* upsertProjectionSection({ emit, label: entry.label, rows: updatedRows })

                  const isObstacleTransition = Option.fromNullable(planEntry.steps[acc.index + 1]).pipe(
                    Option.match({
                      onNone: () => false,
                      onSome: (nextStep) => nextStep.obstaclesEnabled !== plannedStep.obstaclesEnabled
                    })
                  )
                  const isLastForEntry = acc.index + 1 >= planEntry.steps.length

                  if (isObstacleTransition) {
                    yield* sleepWithRunSignal(signal, obstaclePauseMs)
                  } else if (isLastForEntry && entryIndex + 1 < plan.entries.length) {
                    yield* sleepWithRunSignal(signal, corpusPauseMs)
                  }

                  return { rows: updatedRows, index: acc.index + 1 }
                })
            )

            yield* upsertProjectionSection({ emit, label: entry.label, rows: trialRows.rows })
          }),
        { concurrency: 1, discard: true }
      )

      const endedAt = yield* Clock.currentTimeMillis
      const durationMs = endedAt - startedAt

      yield* emit(
        new SectionAppend({
          section: {
            title: "Animation Summary",
            items: [
              { _tag: "Scalar", label: "Total frames", value: frameCount, unit: "frames", format: "integer" },
              {
                _tag: "Scalar",
                label: "Corpus entries",
                value: plan.entries.length,
                unit: "entries",
                format: "integer"
              },
              { _tag: "Scalar", label: "Animation duration", value: durationMs, unit: "ms", format: "fixed" },
              {
                _tag: "Text",
                label: "Proof",
                value:
                  "The run froze browser-only context up front, then rendered each server-authored projection step into both the live stage and the projection transcript."
              }
            ]
          }
        })
      )
    }).pipe(
      Effect.ensuring(setAnimationPlayback(registry, false))
    )
  )
