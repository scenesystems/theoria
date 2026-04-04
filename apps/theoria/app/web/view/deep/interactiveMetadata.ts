import { Match } from "effect"

import type { Id } from "../../../contracts/id.js"

export type ProjectionPlaneHint = {
  readonly stage: string
  readonly evidence: string
  readonly source: string
}

export type TabHint = {
  readonly interactive: string
  readonly evidence: string
}

export const defaultTabHint: TabHint = {
  interactive: "Adjust parameters and see the results change in real time.",
  evidence: "Quantitative evidence from the benchmark — every number is reproducible."
}

const defaultProjectionPlaneHint: ProjectionPlaneHint = {
  stage: defaultTabHint.interactive,
  evidence: defaultTabHint.evidence,
  source: "Inspect the prepared and runtime program projections exactly as executed, file by file."
}

export const projectionPlaneHintFor = (id: Id): ProjectionPlaneHint =>
  Match.value(id).pipe(
    Match.when("effect-text", () => ({
      stage:
        "Generic text and deep-dive reflow both reuse prepared handles — drag width, toggle obstacle bands, or press Run to sweep the same prepare-once model across the corpus.",
      evidence:
        "The live proof follows the shipped v0.2 package story: browser parity profiles, prepare-handle reuse, pure projection under obstacle-aware layout, and the downstream experimental calibration lane.",
      source:
        "Inspect the server proof, browser companion layer, React prepare identity, and the generic plus reflow consumers side by side."
    })),
    Match.when("effect-search", () => ({
      stage:
        "Set a trial budget, press Run, and watch TPE concentrate around the optimum while Random explores uniformly — both run client-side via effect-search.",
      evidence:
        "Full optimization results comparing TPE vs Random search — every trial coordinate and convergence curve is reproducible from a fixed seed.",
      source: defaultProjectionPlaneHint.source
    })),
    Match.when("effect-math", () => ({
      stage:
        "Sweep effect sizes and sample sizes, computing statistical power in real time via effect-math's Distribution kernels.",
      evidence:
        "Live power analysis sweep results, sensitivity tables, and required sample sizes — all computed with normalCdf and normalQuantile, zero simulation.",
      source: defaultProjectionPlaneHint.source
    })),
    Match.when("effect-dsp", () => ({
      stage:
        "Inspect typed sentiment evaluations case-by-case: the contract stays fixed while the heuristic misses reversals and the provider-backed program corrects them.",
      evidence:
        "Provider-backed evaluation traces, correctness deltas, and runtime metadata — every run records the typed program, baseline, and outcome together.",
      source: defaultProjectionPlaneHint.source
    })),
    Match.orElse(() => defaultProjectionPlaneHint)
  )

export const tabHintFor = (id: Id): TabHint => {
  const projectionPlaneHint = projectionPlaneHintFor(id)

  return {
    interactive: projectionPlaneHint.stage,
    evidence: projectionPlaneHint.evidence
  }
}
