import { Match } from "effect"

import type { Id } from "../../../contracts/id.js"

export type TabHint = {
  readonly interactive: string
  readonly evidence: string
}

export const defaultTabHint: TabHint = {
  interactive: "Adjust parameters and see the results change in real time.",
  evidence: "Quantitative evidence from the benchmark — every number is reproducible."
}

export const tabHintFor = (id: Id): TabHint =>
  Match.value(id).pipe(
    Match.when("effect-text", () => ({
      interactive: "Drag width and toggle obstacles to see instant reflow — or press Run to animate the full corpus.",
      evidence:
        "Every width and obstacle layout is a pure projection from one prepared handle — reproducible across the full corpus."
    })),
    Match.when("effect-search", () => ({
      interactive:
        "Set a trial budget, press Run, and watch TPE concentrate around the optimum while Random explores uniformly — both run client-side via effect-search.",
      evidence:
        "Full optimization results comparing TPE vs Random search — every trial coordinate and convergence curve is reproducible from a fixed seed."
    })),
    Match.when("effect-math", () => ({
      interactive:
        "Sweep effect sizes and sample sizes, computing statistical power in real time via effect-math's Distribution kernels.",
      evidence:
        "Live power analysis sweep results, sensitivity tables, and required sample sizes — all computed with normalCdf and normalQuantile, zero simulation."
    })),
    Match.when("effect-dsp", () => ({
      interactive:
        "Inspect typed sentiment evaluations case-by-case: the contract stays fixed while the heuristic misses reversals and the provider-backed program corrects them.",
      evidence:
        "Provider-backed evaluation traces, correctness deltas, and runtime metadata — every run records the typed program, baseline, and outcome together."
    })),
    Match.orElse(() => defaultTabHint)
  )
