import type { FileSystem, Path } from "@effect/platform"
import { Clock, Effect, type Stream } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence.js"
import type { RunData } from "../../../contracts/run.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"
import { sectionEffectsToStream, sectionsToElements } from "../stream-element.js"

import {
  defaultPowerControls,
  nonCentrality,
  overlapCoefficient,
  pdfCurvePoints,
  power,
  powerCurve,
  requiredN
} from "../../../contracts/demo/power.js"

import { preloadProgram } from "./preload.js"

export { preloadProgram }

type EffectMathStreamRequest = {
  readonly controls: {
    readonly alpha: number
    readonly d: number
    readonly n: number
  }
}

const defaultEffectMathStreamRequest: EffectMathStreamRequest = {
  controls: defaultPowerControls
}

const requestFromManifest = (manifest: StreamManifest | null): EffectMathStreamRequest =>
  manifest !== null && manifest._tag === "effect-math"
    ? {
      controls: {
        alpha: manifest.alpha,
        d: manifest.d,
        n: manifest.n
      }
    }
    : defaultEffectMathStreamRequest

// ---------------------------------------------------------------------------
// Sweep parameters — same grid as the client animation
// ---------------------------------------------------------------------------

const effectSizes: ReadonlyArray<number> = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0]
const sampleSizes: ReadonlyArray<number> = [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200]
const alphaLevels: ReadonlyArray<number> = [0.01, 0.05, 0.10]

const targetPower = 0.80

// ---------------------------------------------------------------------------
// Effectful section builders — each is a real computation
// ---------------------------------------------------------------------------

const computeSensitivity = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const rows = effectSizes.map((d) => {
      const rn = requiredN(d, targetPower, request.controls.alpha)
      const p = power(d, request.controls.n, request.controls.alpha)
      const ov = overlapCoefficient(d)
      return [
        d.toFixed(2),
        Number.isFinite(rn) ? String(rn) : "> 10 000",
        (p * 100).toFixed(1),
        (ov * 100).toFixed(1)
      ]
    })
    return {
      title: `Effect Size Sensitivity — N=${request.controls.n}, α=${request.controls.alpha.toFixed(2)}`,
      items: [{
        _tag: "Table",
        label: "Power across effect sizes",
        columns: ["Effect Size (d)", "Required N (80%)", "Power %", "Overlap %"],
        rows
      }]
    }
  })

const computePowerBySampleSize = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const rows = sampleSizes.map((n) => {
      const p02 = power(0.2, n, request.controls.alpha)
      const p05 = power(0.5, n, request.controls.alpha)
      const p08 = power(0.8, n, request.controls.alpha)
      return [
        String(n),
        (p02 * 100).toFixed(1),
        (p05 * 100).toFixed(1),
        (p08 * 100).toFixed(1)
      ]
    })
    return {
      title: `Power by Sample Size — α=${request.controls.alpha.toFixed(2)}`,
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

const computePowerCurves = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const curveSmall = powerCurve(0.2, request.controls.alpha, sampleSizes)
    const curveMedium = powerCurve(0.5, request.controls.alpha, sampleSizes)
    const curveLarge = powerCurve(0.8, request.controls.alpha, sampleSizes)
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

const computeDistributionGeometry = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const d = request.controls.d
    const controlPdf = pdfCurvePoints(0, 1, -4, 4, 100)
    const treatmentPdf = pdfCurvePoints(d, 1, -4, 4.5, 100)
    const overlap = overlapCoefficient(d)
    const delta = nonCentrality(d, request.controls.n)
    return {
      title: `Distribution Geometry — d=${d.toFixed(2)}`,
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
        {
          _tag: "Scalar",
          label: `Non-centrality δ (N=${request.controls.n})`,
          value: delta,
          unit: "",
          format: "fixed"
        },
        { _tag: "Scalar", label: "Overlap coefficient", value: overlap * 100, unit: "%", format: "fixed" }
      ]
    }
  })

const configurationSection = (request: EffectMathStreamRequest): EvidenceSection => ({
  title: "Method",
  items: [
    {
      _tag: "Text",
      label: "Focused controls",
      value: `d=${request.controls.d.toFixed(2)}, n=${request.controls.n}, α=${request.controls.alpha.toFixed(2)}`
    },
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
})

const streamedSectionEffects = (
  request: EffectMathStreamRequest
): ReadonlyArray<Effect.Effect<EvidenceSection, never, never>> => [
  computeSensitivity(request),
  computePowerBySampleSize(request),
  computeRequiredNGrid,
  computePowerCurves(request),
  computeDistributionGeometry(request)
]

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const run: Effect.Effect<RunData, unknown, FileSystem.FileSystem | Path.Path> = Effect.gen(function*() {
  const startedAt = yield* Clock.currentTimeMillis

  const [sensitivity, bySampleSize, requiredGrid, curves, geometry] = yield* Effect.all([
    computeSensitivity(defaultEffectMathStreamRequest),
    computePowerBySampleSize(defaultEffectMathStreamRequest),
    computeRequiredNGrid,
    computePowerCurves(defaultEffectMathStreamRequest),
    computeDistributionGeometry(defaultEffectMathStreamRequest)
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
    sections: [
      sensitivity,
      bySampleSize,
      requiredGrid,
      curves,
      geometry,
      configurationSection(defaultEffectMathStreamRequest)
    ]
  }
})

export const streamSections = (request: EffectMathStreamRequest): Stream.Stream<EvidenceSection, never, never> =>
  sectionEffectsToStream([
    ...streamedSectionEffects(request),
    Effect.succeed(configurationSection(request))
  ])

export const streamElements = (manifest: StreamManifest | null) =>
  sectionsToElements(streamSections(requestFromManifest(manifest)))
