import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match } from "effect"

import type { Id } from "../../contracts/id.js"
import { isEffectSearchRunFrame } from "../state/local-run.js"

import { animatingAtom } from "./animation.js"
import { dspWidgetViewModelAtom } from "./dsp-widget-model.js"
import { optimizationAnimatingAtom, optimizationProjectionAtom } from "./optimization-animation.js"
import { powerAnimatingAtom, powerProjectionAtom } from "./power-animation.js"
import { customTextAtom, reflowControlsAtom } from "./reflow.js"
import {
  type RunRuntimeTelemetryRow,
  type RunRuntimeTelemetrySection,
  type RunRuntimeTelemetryViewModel,
  surfaceLocalRunFrameAtom,
  surfaceRunRuntimeTelemetryViewModelAtom
} from "./surface.js"

const row = (label: string, value: string): RunRuntimeTelemetryRow => ({ label, value })

const section = (
  description: string,
  rows: ReadonlyArray<RunRuntimeTelemetryRow>,
  title: string
): RunRuntimeTelemetrySection => ({
  description,
  kind: "facts",
  rows,
  title
})

const effectTextRows = (
  get: AtomType.Context
): ReadonlyArray<RunRuntimeTelemetryRow> => {
  const controls = get(reflowControlsAtom)
  const customText = get(customTextAtom).trim()

  return [
    row("Text animation", get(animatingAtom) ? "active" : "idle"),
    row(
      "Reflow controls",
      `corpus ${controls.corpusIndex} · width ${controls.width}px · obstacles ${
        controls.obstaclesEnabled ? "on" : "off"
      }`
    ),
    row("Custom text", customText.length === 0 ? "empty" : `${customText.length} chars`)
  ]
}

const effectTextSections = (get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => [
  section(
    "Browser-side animation authority, reflow controls, and custom text state for the local driver.",
    effectTextRows(get),
    "Local driver"
  )
]

const effectSearchRows = (
  get: AtomType.Context
): ReadonlyArray<RunRuntimeTelemetryRow> => {
  const localRunFrame = get(surfaceLocalRunFrameAtom("effect-search"))
  const projection = isEffectSearchRunFrame(localRunFrame)
    ? localRunFrame.projection
    : get(optimizationProjectionAtom)

  return [
    row("Optimizer animation", get(optimizationAnimatingAtom) ? "active" : "idle"),
    row("Optimizer phase", projection.phase),
    row(
      "Search trials",
      `tpe ${projection.tpeTrials.length}/${projection.trialBudget} · random ${projection.randomTrials.length}/${projection.trialBudget}`
    )
  ]
}

const effectSearchSections = (get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => [
  section(
    "Browser-side optimizer phase, search budget, and animation ownership for this run.",
    effectSearchRows(get),
    "Optimizer runtime"
  )
]

const effectMathRows = (
  get: AtomType.Context
): ReadonlyArray<RunRuntimeTelemetryRow> => {
  const projection = get(powerProjectionAtom)

  return [
    row("Power animation", get(powerAnimatingAtom) ? "active" : "idle"),
    row(
      "Power controls",
      `d ${projection.d.toFixed(2)} · n ${projection.n} · alpha ${projection.alpha.toFixed(2)}`
    ),
    row("Power metrics", `${(projection.power * 100).toFixed(1)}% · overlap ${(projection.overlap * 100).toFixed(1)}%`)
  ]
}

const effectMathSections = (get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => [
  section(
    "Browser-side power animation authority and the active statistical controls for the local projection.",
    effectMathRows(get),
    "Power runtime"
  )
]

const effectDspRows = (
  get: AtomType.Context
): ReadonlyArray<RunRuntimeTelemetryRow> => {
  const viewModel = get(dspWidgetViewModelAtom)

  return [
    row("DSP animation", viewModel.isAnimating ? "active" : "idle"),
    row("DSP controls", viewModel.controlsLocked ? "frozen" : "interactive"),
    row(
      "DSP runtime",
      viewModel.runtimeStatus === null
        ? `${viewModel.scenario.label} · ${viewModel.moduleType} · ${viewModel.optimizationBudget.display}`
        : viewModel.runtimeStatus.title
    )
  ]
}

const effectDspSections = (get: AtomType.Context): ReadonlyArray<RunRuntimeTelemetrySection> => [
  section(
    "Browser-side DSP animation authority, control lock state, and active runtime context.",
    effectDspRows(get),
    "DSP runtime"
  )
]

export const surfaceRunLifecycleDiagnosticsViewModelAtom: (
  id: Id
) => AtomType.Atom<RunRuntimeTelemetryViewModel | null> = Atom.family(
  (id: Id) =>
    Atom.make((get: AtomType.Context) => {
      const base = get(surfaceRunRuntimeTelemetryViewModelAtom(id))

      if (base === null) {
        return null
      }

      const localSections = Match.value(id).pipe(
        Match.when("effect-text", () => effectTextSections(get)),
        Match.when("effect-search", () => effectSearchSections(get)),
        Match.when("effect-math", () => effectMathSections(get)),
        Match.when("effect-dsp", () => effectDspSections(get)),
        Match.orElse((): ReadonlyArray<RunRuntimeTelemetrySection> => [])
      )

      return {
        sections: [...base.sections, ...localSections]
      }
    })
)
