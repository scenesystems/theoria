import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, Stream } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence.js"
import type { RunData } from "../../../contracts/run.js"

import {
  nonCentrality,
  overlapCoefficient,
  pdfCurvePoints,
  power,
  powerCurve,
  requiredN
} from "../../../contracts/demo/power.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram }

// ---------------------------------------------------------------------------
// Sweep parameters — same grid as the client animation
// ---------------------------------------------------------------------------

const effectSizes: ReadonlyArray<number> = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
const sampleSizes: ReadonlyArray<number> = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200]
const alphaLevels: ReadonlyArray<number> = [0.01, 0.05, 0.10]

const defaultAlpha = 0.05
const targetPower = 0.80

// ---------------------------------------------------------------------------
// Effectful section builders — each is a real computation
// ---------------------------------------------------------------------------

const computeSensitivity = Effect.sync((): EvidenceSection => {
  const rows = effectSizes.map((d) => {
    const rn = requiredN(d, targetPower, defaultAlpha)
    const p = power(d, 30, defaultAlpha)
    const ov = overlapCoefficient(d)
    return [
      d.toFixed(2),
      Number.isFinite(rn) ? String(rn) : "> 10 000",
      (p * 100).toFixed(1),
      (ov * 100).toFixed(1)
    ]
  })
  return {
    title: "Effect Size Sensitivity — N=30, α=0.05",
    items: [{
      _tag: "Table",
      label: "Power across effect sizes",
      columns: ["Effect Size (d)", "Required N (80%)", "Power %", "Overlap %"],
      rows
    }]
  }
})

const computePowerBySampleSize = Effect.sync((): EvidenceSection => {
  const rows = sampleSizes.map((n) => {
    const p02 = power(0.2, n, defaultAlpha)
    const p05 = power(0.5, n, defaultAlpha)
    const p08 = power(0.8, n, defaultAlpha)
    return [
      String(n),
      (p02 * 100).toFixed(1),
      (p05 * 100).toFixed(1),
      (p08 * 100).toFixed(1)
    ]
  })
  return {
    title: "Power by Sample Size — α=0.05",
    items: [{
      _tag: "Table",
      label: "Power across sample sizes for d=0.2, 0.5, 0.8",
      columns: ["N per group", "Power % (d=0.2)", "Power % (d=0.5)", "Power % (d=0.8)"],
      rows
    }]
  }
})

const computeRequiredNGrid = Effect.sync((): EvidenceSection => {
  const rows = effectSizes.map((d) => {
    const cols = alphaLevels.map((a) => {
      const rn = requiredN(d, targetPower, a)
      return Number.isFinite(rn) ? String(rn) : "> 10 000"
    })
    return [d.toFixed(2), ...cols]
  })
  return {
    title: "Required N Grid — target 80% power",
    items: [{
      _tag: "Table",
      label: "Required N per group by effect size and α",
      columns: ["Effect Size (d)", ...alphaLevels.map((a) => `α = ${a.toFixed(2)}`)],
      rows
    }]
  }
})

const computePowerCurves = Effect.sync((): EvidenceSection => {
  const curveSmall = powerCurve(0.2, defaultAlpha, sampleSizes)
  const curveMedium = powerCurve(0.5, defaultAlpha, sampleSizes)
  const curveLarge = powerCurve(0.8, defaultAlpha, sampleSizes)
  return {
    title: "Power Curves",
    items: [
      {
        _tag: "Series",
        label: "d = 0.2 (small)",
        values: curveSmall.map((p) => p.power),
        unit: "power",
        role: "power-curve"
      },
      {
        _tag: "Series",
        label: "d = 0.5 (medium)",
        values: curveMedium.map((p) => p.power),
        unit: "power",
        role: "power-curve"
      },
      {
        _tag: "Series",
        label: "d = 0.8 (large)",
        values: curveLarge.map((p) => p.power),
        unit: "power",
        role: "power-curve"
      }
    ]
  }
})

const computeDistributionGeometry = Effect.sync((): EvidenceSection => {
  const d = 0.5
  const controlPdf = pdfCurvePoints(0, 1, -4, 4, 100)
  const treatmentPdf = pdfCurvePoints(d, 1, -4, 4.5, 100)
  const overlap = overlapCoefficient(d)
  const delta = nonCentrality(d, 30)
  return {
    title: "Distribution Geometry — d=0.5",
    items: [
      {
        _tag: "Series",
        label: "H₀ PDF (μ=0, σ=1)",
        values: controlPdf.map((p) => p.y),
        unit: "density",
        role: "distribution"
      },
      {
        _tag: "Series",
        label: "H₁ PDF (μ=0.5, σ=1)",
        values: treatmentPdf.map((p) => p.y),
        unit: "density",
        role: "distribution"
      },
      { _tag: "Scalar", label: "Non-centrality δ (N=30)", value: delta, unit: "", format: "fixed" },
      { _tag: "Scalar", label: "Overlap coefficient", value: overlap * 100, unit: "%", format: "fixed" }
    ]
  }
})

const configurationSection: EvidenceSection = {
  title: "Method",
  items: [
    { _tag: "Text", label: "Test type", value: "Two-sided z-test (normal approximation)" },
    { _tag: "Text", label: "Power formula", value: "1 − Φ(z_{α/2} − δ) + Φ(−z_{α/2} − δ), where δ = d·√(n/2)" },
    {
      _tag: "Text",
      label: "Kernels used",
      value: "normalCdf, normalQuantile, normalPdf from effect-math/Distribution"
    },
    {
      _tag: "Text",
      label: "Accuracy note",
      value: "Normal approximation; for N < 20, a noncentral t-distribution yields more precise estimates."
    }
  ]
}

const streamedSectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, never, never>> = [
  computeSensitivity,
  computePowerBySampleSize,
  computeRequiredNGrid,
  computePowerCurves,
  computeDistributionGeometry
]

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis

  const [sensitivity, bySampleSize, requiredGrid, curves, geometry] = yield* Effect.all([
    computeSensitivity,
    computePowerBySampleSize,
    computeRequiredNGrid,
    computePowerCurves,
    computeDistributionGeometry
  ])

  const runnableProgram = yield* preloadProgram
  const endedAt = yield* Clock.currentTimeMillis

  return {
    id: "effect-math",
    packageName: "effect-math",
    summary:
      `effect-math computed ${effectSizes.length} effect sizes × ${sampleSizes.length} sample sizes × ${alphaLevels.length} alpha levels of power analysis using Distribution kernels.`,
    durationMs: endedAt - startedAt,
    program: runnableProgram,
    sections: [sensitivity, bySampleSize, requiredGrid, curves, geometry, configurationSection]
  }
})

export const streamSections: Stream.Stream<EvidenceSection, never, never> = Stream.concat(
  Stream.fromIterable(streamedSectionEffects).pipe(Stream.flatMap(Stream.fromEffect)),
  Stream.succeed(configurationSection)
)
