import type { FileSystem, Path } from "@effect/platform"
import { Effect, Option, Stream } from "effect"

import {
  EffectMathCanonicalStep,
  projectPowerProjection,
  snapshotEffectMathProjectionScript
} from "../../../contracts/capability/effect-math.js"
import { effectMathEntryDescriptor } from "../../../contracts/entry/descriptors/effect-math.js"
import { entryRunIdentityForId } from "../../../contracts/entry/routing.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import { section, step, type StreamElement } from "../../kernel/kinds/stream-element.js"
import { type DemoStreamPlan, phaseFromElementStream } from "../../kernel/kinds/stream-plan.js"

import {
  defaultPowerControls,
  pdfCurvePoints,
  power,
  powerAlphaSweepValues,
  powerCurve,
  powerEffectSizeSweepValues,
  powerSampleSizeSweepValues,
  requiredN
} from "../../../contracts/capability/effect-math.js"
import { preloadProgram } from "./preload.js"

const effectMathRunIdentity = entryRunIdentityForId(effectMathEntryDescriptor.entryId)

type EffectMathStreamRequest = {
  readonly controls: {
    readonly alpha: number
    readonly d: number
    readonly n: number
  }
}

export const defaultEffectMathStreamRequest: EffectMathStreamRequest = {
  controls: defaultPowerControls
}

const requestFromManifest = (manifest: StreamManifest | null): EffectMathStreamRequest =>
  manifest !== null && manifest._tag === effectMathEntryDescriptor.entryId
    ? {
      controls: {
        alpha: manifest.alpha,
        d: manifest.d,
        n: manifest.n
      }
    }
    : defaultEffectMathStreamRequest

const targetPower = 0.80

export const computeSensitivity = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const rows = powerEffectSizeSweepValues.map((d) => {
      const rn = requiredN(d, targetPower, request.controls.alpha)
      const p = power(d, request.controls.n, request.controls.alpha)
      const ov = projectPowerProjection({ d, n: request.controls.n, alpha: request.controls.alpha }).overlap
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

export const computePowerBySampleSize = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const rows = powerSampleSizeSweepValues.map((n) => {
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

export const computeInferenceSummary = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const projection = projectPowerProjection(request.controls)
    const confidenceInterval = projection.confidenceIntervalReport.interval
    const confidenceRange = confidenceInterval.lower === null || confidenceInterval.upper === null
      ? "one-sided interval"
      : `[${confidenceInterval.lower.toFixed(3)}, ${confidenceInterval.upper.toFixed(3)}]`

    return {
      title: "Inferential Summary",
      items: [
        {
          _tag: "Text",
          label: "One-sample t-test",
          value:
            `t=${projection.oneSampleReport.statistic.toFixed(3)} · p=${
              projection.oneSampleReport.pValue.toFixed(4)
            } · `
            + `df=${projection.oneSampleReport.degreesOfFreedom.toFixed(1)}`
        },
        {
          _tag: "Text",
          label: "Two-sample Welch t-test",
          value:
            `t=${projection.twoSampleReport.statistic.toFixed(3)} · p=${
              projection.twoSampleReport.pValue.toFixed(4)
            } · `
            + `estimate=${projection.twoSampleReport.estimate.toFixed(3)}`
        },
        {
          _tag: "Text",
          label: `${
            (projection.confidenceIntervalReport.interval.confidenceLevel * 100).toFixed(0)
          }% confidence interval`,
          value: confidenceRange
        }
      ]
    }
  })

export const computeSolverStatus = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const projection = projectPowerProjection(request.controls)

    return {
      title: "Solver Status",
      items: [
        {
          _tag: "Text",
          label: "Sample-size inversion",
          value: `${projection.sampleSizeReport.solver.method} · ${projection.sampleSizeReport.solver.status} · `
            + `${projection.sampleSizeReport.solver.iterationCount} iterations`
        },
        {
          _tag: "Scalar",
          label: "Achieved power at solved N",
          value: projection.sampleSizeReport.achievedPower * 100,
          unit: "%",
          format: "fixed"
        },
        {
          _tag: "Scalar",
          label: "Critical value",
          value: projection.powerReport.criticalValue,
          unit: "t",
          format: "fixed"
        }
      ]
    }
  })

export const computeRequiredNGrid = Effect.sync((): EvidenceSection => {
  const rows = powerEffectSizeSweepValues.map((d) => {
    const cols = powerAlphaSweepValues.map((a) => {
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
      columns: ["Effect Size (d)", ...powerAlphaSweepValues.map((a) => `α = ${a.toFixed(2)}`)],
      rows
    }]
  }
})

export const computePowerCurves = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const curveSmall = powerCurve(0.2, request.controls.alpha, powerSampleSizeSweepValues)
    const curveMedium = powerCurve(0.5, request.controls.alpha, powerSampleSizeSweepValues)
    const curveLarge = powerCurve(0.8, request.controls.alpha, powerSampleSizeSweepValues)
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

export const computeDistributionGeometry = (request: EffectMathStreamRequest) =>
  Effect.sync((): EvidenceSection => {
    const d = request.controls.d
    const controlPdf = pdfCurvePoints(0, 1, -4, 4, 100)
    const treatmentPdf = pdfCurvePoints(d, 1, -4, 4.5, 100)
    const projection = projectPowerProjection(request.controls)
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
          value: projection.nonCentrality,
          unit: "",
          format: "fixed"
        },
        { _tag: "Scalar", label: "Overlap coefficient", value: projection.overlap * 100, unit: "%", format: "fixed" }
      ]
    }
  })

export const configurationSection = (request: EffectMathStreamRequest): EvidenceSection => ({
  title: "Method",
  items: [
    {
      _tag: "Text",
      label: "Focused controls",
      value: `d=${request.controls.d.toFixed(2)}, n=${request.controls.n}, α=${request.controls.alpha.toFixed(2)}`
    },
    { _tag: "Text", label: "Test type", value: "Two-sided mean-difference power and inference reports" },
    {
      _tag: "Text",
      label: "Kernels used",
      value:
        "powerForMeanDifference, sampleSizeForTargetPower, confidenceIntervalMean, and twoSampleTTest from effect-math/Statistics"
    },
    {
      _tag: "Text",
      label: "Accuracy note",
      value:
        "Effect-math now owns the noncentral-t power lane, Brent-backed sample-size inversion, and released t-test report envelopes."
    }
  ]
})

export const runSummary =
  `effect-math computed ${powerEffectSizeSweepValues.length} effect sizes × ${powerSampleSizeSweepValues.length} sample sizes × ${powerAlphaSweepValues.length} alpha levels of power analysis and inferential summaries using released Statistics reports.`

const runtimeSummarySection = (request: EffectMathStreamRequest): EvidenceSection => {
  const runPlan = snapshotEffectMathProjectionScript(request.controls)
  const totalTrials = runPlan.phases.reduce((count, phase) => count + phase.steps.length, 0)

  return {
    title: "Runtime Summary",
    items: [
      { _tag: "Scalar", label: "Total trials computed", value: totalTrials, unit: "trials", format: "integer" },
      {
        _tag: "Scalar",
        label: "Effect sizes explored",
        value: powerEffectSizeSweepValues.length,
        unit: "levels",
        format: "integer"
      },
      {
        _tag: "Scalar",
        label: "Sample sizes explored",
        value: powerSampleSizeSweepValues.length,
        unit: "levels",
        format: "integer"
      },
      {
        _tag: "Scalar",
        label: "Alpha levels explored",
        value: powerAlphaSweepValues.length,
        unit: "levels",
        format: "integer"
      },
      {
        _tag: "Text",
        label: "Proof",
        value:
          "The run froze its sweep plan once, authored every power frame on the server, and streamed package-owned evidence without reconstructing terminal sections in the browser."
      }
    ]
  }
}

const projectionStepElements = (request: EffectMathStreamRequest) =>
  snapshotEffectMathProjectionScript(request.controls).phases.flatMap((phase) =>
    phase.steps.map((controls) =>
      step(new EffectMathCanonicalStep({ controls, projection: projectPowerProjection(controls) }))
    )
  )

const streamPhaseEffects = (
  request: EffectMathStreamRequest
): ReadonlyArray<{
  readonly name: string
  readonly stream: Stream.Stream<StreamElement, never, never>
}> => [
  {
    name: "projection-frames",
    stream: Stream.fromIterable(projectionStepElements(request))
  },
  { name: "effect-size-sensitivity", stream: Stream.fromEffect(computeSensitivity(request)).pipe(Stream.map(section)) },
  {
    name: "power-by-sample-size",
    stream: Stream.fromEffect(computePowerBySampleSize(request)).pipe(Stream.map(section))
  },
  { name: "required-n-grid", stream: Stream.fromEffect(computeRequiredNGrid).pipe(Stream.map(section)) },
  { name: "power-curves", stream: Stream.fromEffect(computePowerCurves(request)).pipe(Stream.map(section)) },
  {
    name: "distribution-geometry",
    stream: Stream.fromEffect(computeDistributionGeometry(request)).pipe(Stream.map(section))
  },
  {
    name: "inferential-summary",
    stream: Stream.fromEffect(computeInferenceSummary(request)).pipe(Stream.map(section))
  },
  { name: "solver-status", stream: Stream.fromEffect(computeSolverStatus(request)).pipe(Stream.map(section)) },
  { name: "method", stream: Stream.succeed(section(configurationSection(request))) },
  { name: "runtime-summary", stream: Stream.succeed(section(runtimeSummarySection(request))) }
]

export const streamSections = (request: EffectMathStreamRequest): Stream.Stream<EvidenceSection, never, never> =>
  Stream.fromIterable(streamPhaseEffects(request)).pipe(
    Stream.flatMap(({ stream }) => stream),
    Stream.filterMap((element) => element._tag === "section" ? Option.some(element.section) : Option.none())
  )

export const streamElements = (manifest: StreamManifest | null) =>
  Stream.fromIterable(streamPhaseEffects(requestFromManifest(manifest))).pipe(
    Stream.flatMap(({ stream }) => stream)
  )

export const streamPlan = (
  manifest: StreamManifest | null
): Effect.Effect<DemoStreamPlan<FileSystem.FileSystem | Path.Path, unknown>, never, never> =>
  Effect.succeed({
    packageName: effectMathRunIdentity.packageName,
    program: preloadProgram,
    summary: runSummary,
    phases: streamPhaseEffects(requestFromManifest(manifest)).map(({ name, stream }) =>
      phaseFromElementStream(name, stream)
    )
  })
