import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Clock, Effect } from "effect"
import { Study } from "effect-search"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { corpus } from "../../contracts/corpus.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { SectionAppend, SectionUpsert } from "../../contracts/evidence-stream.js"
import type { EvidenceItem } from "../../contracts/evidence.js"
import {
  customTextAtom,
  type EffectTextRunFrame,
  type EffectTextRunPlan,
  prepareReflowEntry,
  projectReflowProjection,
  reflowControlsAtom,
  reflowSliderMaxWidth,
  resolveReflowCorpusEntry
} from "./reflow.js"
import { awaitRunSignal, type RunSignal, sleepWithRunSignal } from "./run-lifecycle.js"

export const animatingAtom: AtomType.Writable<boolean> = Atom.make(false)

const defaultReflowWidth = Math.round(reflowSliderMaxWidth / 2)
const stepDelayMs = 12
const corpusPauseMs = 300
const obstaclePauseMs = 400

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

export const resetAnimationState = (ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    const hasCustomText = ctx(customTextAtom).trim().length > 0

    ctx.set(animatingAtom, false)
    ctx.set(reflowControlsAtom, {
      corpusIndex: hasCustomText ? corpus.length : 0,
      width: defaultReflowWidth,
      obstaclesEnabled: false
    })
  })

export const makeAnimationStream = (
  ctx: AtomType.FnContext,
  signal: RunSignal,
  plan: EffectTextRunPlan
): Stream.Stream<EffectTextAnimationEvent, never, never> =>
  Study.streamFromEmitter<EffectTextAnimationEvent, void, never, never>((emit) =>
    Effect.gen(function*() {
      ctx.set(animatingAtom, true)

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
              (acc, step) =>
                Effect.gen(function*() {
                  yield* awaitRunSignal(signal)
                  const projection = projectReflowProjection({
                    entry,
                    obstaclesEnabled: step.obstaclesEnabled,
                    prepared,
                    requestedWidthPx: step.requestedWidthPx,
                    stageWidthPx: step.stageWidthPx
                  })
                  const frame: EffectTextRunFrame = {
                    _tag: "effect-text",
                    controls: {
                      corpusIndex: planEntry.corpusIndex,
                      width: step.stageWidthPx,
                      obstaclesEnabled: step.obstaclesEnabled
                    },
                    projection
                  }

                  yield* emitFrameUpdate({ emit, frame })

                  yield* sleepWithRunSignal(signal, stepDelayMs)

                  const updatedRows = Arr.append(acc.rows, {
                    corpusLabel: entry.label,
                    width: projection.stageWidthPx,
                    obstacles: step.obstaclesEnabled,
                    lineCount: projection.summary.lineCount,
                    height: projection.summary.height,
                    maxLineWidth: projection.summary.maxLineWidth
                  })

                  yield* upsertProjectionSection({ emit, label: entry.label, rows: updatedRows })

                  const isObstacleTransition = Option.fromNullable(planEntry.steps[acc.index + 1]).pipe(
                    Option.match({
                      onNone: () => false,
                      onSome: (nextStep) => nextStep.obstaclesEnabled !== step.obstaclesEnabled
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
                  "The run froze its text plan up front, prepared each entry once, and projected every width and obstacle combination from that shared authority."
              }
            ]
          }
        })
      )
    }).pipe(
      Effect.ensuring(resetAnimationState(ctx))
    )
  )
