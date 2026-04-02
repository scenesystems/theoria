import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import type { Stream } from "effect"
import { Clock, Effect } from "effect"
import { Study } from "effect-search"
import * as Arr from "effect/Array"

import {
  defaultPowerControls,
  nonCentrality,
  overlapCoefficient,
  power,
  requiredN
} from "../../contracts/demo/power.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import { SectionAppend, SectionUpsert } from "../../contracts/evidence-stream.js"
import type { EvidenceItem } from "../../contracts/evidence.js"
import { awaitRunSignal, type RunSignal, sleepWithRunSignal } from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

export type PowerControls = {
  readonly d: number
  readonly n: number
  readonly alpha: number
}

export const powerControlsAtom: AtomType.Writable<PowerControls> = Atom.make<PowerControls>(defaultPowerControls)

export const powerAnimatingAtom: AtomType.Writable<boolean> = Atom.make(false)

// ---------------------------------------------------------------------------
// Derived projection
// ---------------------------------------------------------------------------

export type PowerProjection = {
  readonly d: number
  readonly n: number
  readonly alpha: number
  readonly power: number
  readonly requiredN: number
  readonly overlap: number
  readonly nonCentrality: number
}

export type EffectMathRunPhase = {
  readonly title: string
  readonly label: string
  readonly steps: ReadonlyArray<PowerControls>
}

export type EffectMathRunPlan = {
  readonly _tag: "effect-math"
  readonly baseControls: PowerControls
  readonly phases: ReadonlyArray<EffectMathRunPhase>
}

export type EffectMathRunFrame = {
  readonly _tag: "effect-math"
  readonly controls: PowerControls
  readonly projection: PowerProjection
}

export const projectPowerProjection = ({ d, n, alpha }: PowerControls): PowerProjection => ({
  d,
  n,
  alpha,
  power: power(d, n, alpha),
  requiredN: requiredN(d, 0.80, alpha),
  overlap: overlapCoefficient(d),
  nonCentrality: nonCentrality(d, n)
})

const fixedSampleSizeLabel = (n: number): string => `Power by effect size (fixed N=${n})`
const fixedSampleSizeTitle = ({ alpha, n }: PowerControls): string =>
  `Effect size sweep — N=${n}, α=${alpha.toFixed(2)}`
const fixedEffectSizeLabel = (d: number): string => `Power by sample size (fixed d=${d.toFixed(2)})`
const fixedEffectSizeTitle = ({ alpha, d }: PowerControls): string =>
  `Sample size sweep — d=${d.toFixed(2)}, α=${alpha.toFixed(2)}`

export const snapshotEffectMathRunPlan = (baseControls: PowerControls): EffectMathRunPlan => ({
  _tag: "effect-math",
  baseControls,
  phases: [
    {
      title: fixedSampleSizeTitle(baseControls),
      label: fixedSampleSizeLabel(baseControls.n),
      steps: Arr.map(effectSizeSteps, (d): PowerControls => ({ d, n: baseControls.n, alpha: baseControls.alpha }))
    },
    {
      title: fixedEffectSizeTitle(baseControls),
      label: fixedEffectSizeLabel(baseControls.d),
      steps: Arr.map(sampleSizeSteps, (n): PowerControls => ({ d: baseControls.d, n, alpha: baseControls.alpha }))
    },
    {
      title: "Required N at 80% power — across α levels",
      label: "Required N by effect size and α",
      steps: Arr.flatMap(alphaLevels, (alpha) =>
        Arr.map(effectSizeSteps, (d): PowerControls => {
          const requiredSampleSize = requiredN(d, 0.80, alpha)
          return {
            d,
            n: Number.isFinite(requiredSampleSize) ? requiredSampleSize : 200,
            alpha
          }
        }))
    }
  ]
})

export const powerProjectionAtom: AtomType.Atom<PowerProjection> = Atom.make(
  (get: AtomType.Context): PowerProjection => projectPowerProjection(get(powerControlsAtom))
)

// ---------------------------------------------------------------------------
// Animation parameters
// ---------------------------------------------------------------------------

const effectSizeSteps: ReadonlyArray<number> = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
const sampleSizeSteps: ReadonlyArray<number> = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200]
const alphaLevels: ReadonlyArray<number> = [0.01, 0.05, 0.10]

const stepDelayMs = 40
const phasePauseMs = 500
const sweepSettleMs = 80

type TrialRow = {
  readonly effectSize: number
  readonly sampleSize: number
  readonly alpha: number
  readonly power: number
  readonly requiredN: number
  readonly overlap: number
}

const initialTrialRows: ReadonlyArray<TrialRow> = []

const trialColumns: ReadonlyArray<string> = [
  "Effect Size (d)",
  "N per group",
  "α",
  "Power",
  "Required N (80%)",
  "Overlap %"
]

const rowToStrings = (row: TrialRow): ReadonlyArray<string> => [
  row.effectSize.toFixed(2),
  String(row.sampleSize),
  row.alpha.toFixed(2),
  (row.power * 100).toFixed(1),
  Number.isFinite(row.requiredN) ? String(row.requiredN) : "> 10 000",
  (row.overlap * 100).toFixed(1)
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

const upsertPhaseSection = ({
  emit,
  label,
  rows,
  title
}: {
  readonly emit: (event: EvidenceEvent) => Effect.Effect<void, never, never>
  readonly label: string
  readonly rows: ReadonlyArray<TrialRow>
  readonly title: string
}): Effect.Effect<void, never, never> =>
  emit(
    new SectionUpsert({
      section: {
        title,
        items: [makeTrialTable(label, rows)]
      }
    })
  )

type EffectMathAnimationEvent = EvidenceEvent | {
  readonly _tag: "LocalRunFrameUpdated"
  readonly frame: EffectMathRunFrame
}

const emitFrameUpdate = ({
  emit,
  frame
}: {
  readonly emit: (event: EffectMathAnimationEvent) => Effect.Effect<void, never, never>
  readonly frame: EffectMathRunFrame
}): Effect.Effect<void, never, never> =>
  emit({
    _tag: "LocalRunFrameUpdated",
    frame
  })

// ---------------------------------------------------------------------------
// Animation stream
// ---------------------------------------------------------------------------

const sectionUpsertInterval = 5

export const setPowerAnimationPlayback = (
  registry: RunRegistry,
  isAnimating: boolean
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(powerAnimatingAtom, isAnimating)
  })

export const syncPowerFrameToControls = (
  registry: RunRegistry,
  frame: EffectMathRunFrame
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    registry.set(powerControlsAtom, frame.controls)
  })

const sweepPhase = (
  emit: (event: EffectMathAnimationEvent) => Effect.Effect<void, never, never>,
  phase: EffectMathRunPhase,
  signal: RunSignal,
  onRows: (rows: ReadonlyArray<TrialRow>) => Effect.Effect<void, never, never>
): Effect.Effect<ReadonlyArray<TrialRow>, never, never> =>
  Effect.reduce(
    phase.steps,
    initialTrialRows,
    (rows, controls, index) =>
      Effect.gen(function*() {
        yield* awaitRunSignal(signal)
        const projection = projectPowerProjection(controls)

        yield* emitFrameUpdate({
          emit,
          frame: {
            _tag: "effect-math",
            controls,
            projection
          }
        })

        const isLast = index === phase.steps.length - 1
        yield* sleepWithRunSignal(signal, isLast ? sweepSettleMs : stepDelayMs)

        const nextRow: TrialRow = {
          effectSize: controls.d,
          sampleSize: controls.n,
          alpha: controls.alpha,
          power: projection.power,
          requiredN: projection.requiredN,
          overlap: projection.overlap
        }
        const nextRows = Arr.append(rows, nextRow)
        const shouldEmitTable = isLast || (index + 1) % sectionUpsertInterval === 0
        if (shouldEmitTable) {
          yield* onRows(nextRows)
        }
        return nextRows
      })
  )

export const resetPowerAnimationState = (registry: RunRegistry): void => {
  registry.set(powerControlsAtom, defaultPowerControls)
  registry.set(powerAnimatingAtom, false)
}

export const resetPowerAnimationStateEffect = (registry: RunRegistry): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    resetPowerAnimationState(registry)
  })

export const makePowerAnimationStream = (
  registry: RunRegistry,
  signal: RunSignal,
  plan: EffectMathRunPlan
): Stream.Stream<EffectMathAnimationEvent, never, never> =>
  Study.streamFromEmitter<EffectMathAnimationEvent, void, never, never>((emit) =>
    Effect.gen(function*() {
      registry.set(powerAnimatingAtom, true)
      const startedAt = yield* Clock.currentTimeMillis
      const phaseRows = yield* Effect.forEach(
        plan.phases,
        (phase, index) =>
          sweepPhase(
            emit,
            phase,
            signal,
            (rows) =>
              upsertPhaseSection({
                emit,
                label: phase.label,
                rows,
                title: phase.title
              })
          ).pipe(
            Effect.tap(() =>
              index + 1 < plan.phases.length
                ? sleepWithRunSignal(signal, phasePauseMs)
                : Effect.void
            )
          ),
        { concurrency: 1 }
      )
      const totalTrials = Arr.reduce(phaseRows, 0, (count, rows) => count + rows.length)

      const endedAt = yield* Clock.currentTimeMillis
      const durationMs = endedAt - startedAt

      yield* emit(
        new SectionAppend({
          section: {
            title: "Animation Summary",
            items: [
              { _tag: "Scalar", label: "Total trials computed", value: totalTrials, unit: "trials", format: "integer" },
              {
                _tag: "Scalar",
                label: "Effect sizes explored",
                value: effectSizeSteps.length,
                unit: "levels",
                format: "integer"
              },
              {
                _tag: "Scalar",
                label: "Sample sizes explored",
                value: sampleSizeSteps.length,
                unit: "levels",
                format: "integer"
              },
              {
                _tag: "Scalar",
                label: "Alpha levels explored",
                value: alphaLevels.length,
                unit: "levels",
                format: "integer"
              },
              { _tag: "Scalar", label: "Animation duration", value: durationMs, unit: "ms", format: "fixed" },
              {
                _tag: "Text",
                label: "Proof",
                value:
                  "The run froze its power sweep plan at start, emitted canonical power frames from shared runtime authority, and computed each frame with pure effect-math kernels."
              }
            ]
          }
        })
      )
    }).pipe(
      Effect.ensuring(resetPowerAnimationStateEffect(registry))
    )
  )
