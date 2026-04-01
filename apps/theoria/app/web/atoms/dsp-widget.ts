import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import * as Arr from "effect/Array"

import type { MetricAppearance } from "../view/primitives/designSystem.js"
import type { WidgetMetric } from "./widget-view-models.js"

type DspEvaluationCase = {
  readonly label: string
  readonly input: string
  readonly expectedLabel: string
  readonly heuristicLabel: string
  readonly heuristicRationale: string
  readonly modelLabel: string
  readonly modelRationale: string
  readonly note: string
}

type DspEvaluationCaseViewModel = DspEvaluationCase & {
  readonly heuristicCorrect: boolean
  readonly modelCorrect: boolean
  readonly delta: string
}

export type DspWidgetViewModel = {
  readonly activeCase: DspEvaluationCaseViewModel
  readonly activeIndex: number
  readonly contract: {
    readonly instruction: string
    readonly inputField: string
    readonly outputField: string
  }
  readonly metrics: ReadonlyArray<WidgetMetric>
  readonly options: ReadonlyArray<{ readonly index: number; readonly label: string }>
}

const neutralMetricAppearance: MetricAppearance = { _tag: "neutral" }
const dangerMetricAppearance: MetricAppearance = { _tag: "danger" }
const dspMetricAppearance: MetricAppearance = { _tag: "tone", tone: "dsp" }

const classifierInstruction = "Classify short sentiment text"
const inputField = "text"
const outputField = "label"

const defaultCase: DspEvaluationCase = {
  label: "Negation and expectation",
  input: "I expected to hate this migration, but typed envelopes made incident response dramatically calmer.",
  expectedLabel: "positive",
  heuristicLabel: "negative",
  heuristicRationale: "The baseline keys on 'hate' and misses the reversal introduced by 'but'.",
  modelLabel: "positive",
  modelRationale:
    "The typed program keeps the task and output schema fixed, so the provider can resolve the actual sentiment.",
  note:
    "Press Run to execute this same contract against the configured provider and compare it with the heuristic baseline end-to-end."
}

const evaluationCases: ReadonlyArray<DspEvaluationCase> = [
  defaultCase,
  {
    label: "Praise hiding failure",
    input: "Love the new dashboard, except it still drops the audit trail every Friday night.",
    expectedLabel: "negative",
    heuristicLabel: "positive",
    heuristicRationale: "Keyword heuristics over-weight the opening praise and ignore the failure clause that follows.",
    modelLabel: "negative",
    modelRationale:
      "The provider-backed classifier follows the typed instruction and returns the failure-centered label.",
    note:
      "Typed DSP programs stay measurable because the expected label, baseline output, and provider output all share one contract."
  },
  {
    label: "Operational neutrality",
    input: "The provider rotated models overnight and the typed classifier kept emitting the same label schema.",
    expectedLabel: "neutral",
    heuristicLabel: "neutral",
    heuristicRationale:
      "Straightforward operational language is easy for a lightweight baseline when nothing reverses the sentiment.",
    modelLabel: "neutral",
    modelRationale:
      "effect-dsp still matters on parity cases because the contract remains stable even when the backing model changes.",
    note:
      "The point is not only dramatic wins — it is reliable, typed programs whose behavior can be evaluated and reproduced."
  }
]

const normalizeLabel = (value: string): string => value.trim().toLowerCase()

const isCorrect = (candidate: string, expected: string): boolean => normalizeLabel(candidate) === expected

const deltaLabel = (heuristicCorrect: boolean, modelCorrect: boolean): string => {
  if (heuristicCorrect === modelCorrect) {
    return "Parity"
  }

  return modelCorrect ? "+1 correction" : "Regression"
}

export const dspEvaluationCaseIndexAtom = Atom.make(0)

export const selectDspEvaluationCaseAtom = Atom.fnSync<number>()(
  (index, ctx) => {
    ctx.set(dspEvaluationCaseIndexAtom, index)
  }
)

export const dspWidgetViewModelAtom: AtomType.Atom<DspWidgetViewModel> = Atom.make(
  (get: AtomType.Context): DspWidgetViewModel => {
    const activeIndex = get(dspEvaluationCaseIndexAtom)
    const selectedCase = evaluationCases[activeIndex] ?? defaultCase
    const heuristicCorrect = isCorrect(selectedCase.heuristicLabel, selectedCase.expectedLabel)
    const modelCorrect = isCorrect(selectedCase.modelLabel, selectedCase.expectedLabel)

    return {
      activeCase: {
        ...selectedCase,
        heuristicCorrect,
        modelCorrect,
        delta: deltaLabel(heuristicCorrect, modelCorrect)
      },
      activeIndex,
      contract: {
        instruction: classifierInstruction,
        inputField,
        outputField
      },
      metrics: [
        { label: "Schema", value: "1 in / 1 out", appearance: dspMetricAppearance },
        {
          label: "Heuristic",
          value: heuristicCorrect ? "correct" : "miss",
          appearance: heuristicCorrect ? neutralMetricAppearance : dangerMetricAppearance
        },
        {
          label: "Typed program",
          value: modelCorrect ? "correct" : "miss",
          appearance: modelCorrect ? dspMetricAppearance : dangerMetricAppearance
        },
        {
          label: "Delta",
          value: deltaLabel(heuristicCorrect, modelCorrect),
          appearance: modelCorrect && !heuristicCorrect
            ? dspMetricAppearance
            : modelCorrect === heuristicCorrect
            ? neutralMetricAppearance
            : dangerMetricAppearance
        }
      ],
      options: Arr.map(evaluationCases, (entry, index) => ({ index, label: entry.label }))
    }
  }
)
