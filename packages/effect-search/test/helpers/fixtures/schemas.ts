import { Schema } from "effect"

import { Direction } from "../../../src/Direction.js"
import { Choice } from "../../../src/Distribution.js"
import { CandidateRollPair } from "../../../src/internal/tpe/dimensions/trace.js"
import { PercentileOptions, PercentileTrialState } from "../../../src/Pruning.js"
import { PromptCategoricalConfig } from "../../fixtures/scenarios/promptCategorical.js"

const FixtureMetadata = Schema.Struct({
  generatedAt: Schema.String,
  upstream: Schema.Struct({
    name: Schema.Literal("optuna"),
    version: Schema.Literal("4.9.0")
  }),
  generator: Schema.Struct({
    script: Schema.String
  })
})

const NumericSentinel = Schema.Literals(["NaN", "Infinity", "-Infinity"])

const NumericTraceValue = Schema.Union([Schema.Finite, NumericSentinel])

const IntermediateValue = Schema.Struct({
  step: Schema.Finite,
  value: NumericTraceValue
})

const PrimitiveConfig = Schema.Record(Schema.String, Choice)

const ObjectivePoint = Schema.Array(Schema.Finite)

const CategoricalParzenFixtureName = Schema.Literals([
  "categorical-parzen.basic",
  "categorical-parzen.distance",
  "categorical-parzen.recency-ramp"
])

const CategoricalDistanceMetric = Schema.Literal("absolute")

const CategoricalParzenExpected = Schema.Struct({
  kernelWeights: Schema.Array(Schema.Finite),
  probabilities: Schema.Array(Schema.Finite),
  kernels: Schema.Array(Schema.Array(Schema.Finite)),
  candidateRolls: Schema.Array(Schema.Finite),
  expectedCandidates: Schema.Array(Choice)
})

export const CategoricalParzenFixture = Schema.Struct({
  fixture: CategoricalParzenFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    choices: Schema.Array(Choice),
    observations: Schema.Array(Choice),
    distanceMetric: Schema.optional(CategoricalDistanceMetric),
    expected: CategoricalParzenExpected
  })
})

export type CategoricalParzenFixture = Schema.Schema.Type<typeof CategoricalParzenFixture>

const GammaCase = Schema.Struct({
  nTrials: Schema.Finite,
  defaultGamma: Schema.Finite,
  hyperoptGamma: Schema.Finite
})

export const GammaFixture = Schema.Struct({
  fixture: Schema.Literal("gamma.default-gamma"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cap: Schema.Finite,
    cases: Schema.Array(GammaCase)
  })
})

export type GammaFixture = Schema.Schema.Type<typeof GammaFixture>

const SplitTrial = Schema.Struct({
  trialNumber: Schema.Finite,
  state: Schema.Literals(["complete", "pruned", "running"]),
  value: Schema.optional(NumericTraceValue),
  intermediateValues: Schema.Array(IntermediateValue),
  liarValue: Schema.optional(NumericTraceValue),
  isFeasible: Schema.optional(Schema.Boolean)
})

const SplitTrialsCase = Schema.Struct({
  id: Schema.String,
  direction: Direction,
  nBelow: Schema.Finite,
  trials: Schema.Array(SplitTrial),
  expectedBelow: Schema.Array(Schema.Finite),
  expectedAbove: Schema.Array(Schema.Finite)
})

export const SplitTrialsFixture = Schema.Struct({
  fixture: Schema.Literal("split-trials.single-and-liar"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(SplitTrialsCase)
  })
})

export type SplitTrialsFixture = Schema.Schema.Type<typeof SplitTrialsFixture>

const PrunedScoreCase = Schema.Struct({
  id: Schema.String,
  trialNumber: Schema.Finite,
  intermediateValues: Schema.Array(IntermediateValue),
  expectedStep: Schema.Finite,
  expectedScore: NumericTraceValue
})

export const PrunedScoreFixture = Schema.Struct({
  fixture: Schema.Literal("pruned-score.pruned-ordering"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    direction: Direction,
    cases: Schema.Array(PrunedScoreCase),
    expectedOrder: Schema.Array(Schema.Finite)
  })
})

export type PrunedScoreFixture = Schema.Schema.Type<typeof PrunedScoreFixture>

const EiFixtureName = Schema.Literals(["ei.basic", "ei.mixed-trace"])

const EiScoreTrace = Schema.Struct({
  candidate: Schema.String,
  logL: Schema.Finite,
  logG: Schema.Finite,
  expected: Schema.Finite
})

export const EiCategoricalFixture = Schema.Struct({
  fixture: EiFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    scoreTrace: Schema.Array(EiScoreTrace),
    scoreVector: Schema.Array(Schema.Finite),
    expectedBestIndex: Schema.Finite
  })
})

export type EiCategoricalFixture = Schema.Schema.Type<typeof EiCategoricalFixture>

const ContinuousKernelExpectation = Schema.Struct({
  mean: Schema.Finite,
  sigma: Schema.Finite,
  weight: Schema.Finite
})

const ContinuousKdeFixtureName = Schema.Literals([
  "continuous-kde.basic",
  "continuous-kde.bimodal-separated",
  "continuous-kde.boundary-high-skew",
  "continuous-kde.boundary-low-skew",
  "continuous-kde.endpoint-observations",
  "continuous-kde.extreme-asymmetric-range",
  "continuous-kde.magic-clip",
  "continuous-kde.micro-positive-span",
  "continuous-kde.narrow-support",
  "continuous-kde.offset-positive-range",
  "continuous-kde.outlier-cluster",
  "continuous-kde.prior-only",
  "continuous-kde.repeated-support-point",
  "continuous-kde.recency-ramp",
  "continuous-kde.single-observation",
  "continuous-kde.tiny-cross-zero-span",
  "continuous-kde.upper-boundary-cluster",
  "continuous-kde.wide-negative-range"
])

const ContinuousLogDensityTrace = Schema.Struct({
  probe: Schema.Finite,
  expected: Schema.Finite
})

const ContinuousExpected = Schema.Struct({
  kernels: Schema.Array(ContinuousKernelExpectation),
  logDensities: Schema.Array(ContinuousLogDensityTrace),
  candidateRolls: Schema.Array(CandidateRollPair),
  expectedSamples: Schema.Array(Schema.Finite)
})

export const ContinuousKdeFixture = Schema.Struct({
  fixture: ContinuousKdeFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    observations: Schema.Array(Schema.Finite),
    low: Schema.Finite,
    high: Schema.Finite,
    expected: ContinuousExpected
  })
})

export type ContinuousKdeFixture = Schema.Schema.Type<typeof ContinuousKdeFixture>

const NoiseBandwidthExpected = Schema.Struct({
  baseSigmas: Schema.Array(Schema.Finite)
})

const NoiseBandwidthCase = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Finite),
  low: Schema.Finite,
  high: Schema.Finite,
  expected: NoiseBandwidthExpected
})

export const NoiseBandwidthFixture = Schema.Struct({
  fixture: Schema.Literal("noise-bandwidth.parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(NoiseBandwidthCase)
  })
})

export type NoiseBandwidthFixture = Schema.Schema.Type<typeof NoiseBandwidthFixture>

const MultivariateGaussianDensityCase = Schema.Struct({
  id: Schema.String,
  point: Schema.Array(Schema.Finite),
  mean: Schema.Array(Schema.Finite),
  sigmas: Schema.Array(Schema.Finite),
  expectedLogDensity: Schema.Finite
})

const MultivariateGaussianSamplingCase = Schema.Struct({
  id: Schema.String,
  mean: Schema.Array(Schema.Finite),
  sigmas: Schema.Array(Schema.Finite),
  rolls: Schema.Array(Schema.Finite),
  expectedSample: Schema.Array(Schema.Finite)
})

const MultivariateGaussianMixtureCase = Schema.Struct({
  means: Schema.Array(Schema.Array(Schema.Finite)),
  sigmas: Schema.Array(Schema.Array(Schema.Finite)),
  weights: Schema.Array(Schema.Finite),
  componentRoll: Schema.Finite,
  valueRolls: Schema.Array(Schema.Finite),
  expectedSample: Schema.Array(Schema.Finite),
  expectedLogDensity: Schema.Finite
})

export const MultivariateGaussianFixture = Schema.Struct({
  fixture: Schema.Literal("multivariate-gaussian.parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    densityCases: Schema.Array(MultivariateGaussianDensityCase),
    samplingCases: Schema.Array(MultivariateGaussianSamplingCase),
    mixtureCase: MultivariateGaussianMixtureCase
  })
})

export type MultivariateGaussianFixture = Schema.Schema.Type<typeof MultivariateGaussianFixture>

const TruncatedNormalCase = Schema.Struct({
  id: Schema.String,
  params: Schema.Struct({
    mean: Schema.Finite,
    sigma: Schema.Finite,
    low: Schema.Finite,
    high: Schema.Finite
  }),
  sampleQuantiles: Schema.Array(Schema.Finite),
  sampleExpected: Schema.Array(Schema.Finite),
  logPdfProbes: Schema.Array(Schema.Finite),
  logPdfExpected: Schema.Array(Schema.Finite)
})

export const TruncatedNormalFixture = Schema.Struct({
  fixture: Schema.Literal("truncated-normal.edge-cases"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(TruncatedNormalCase)
  })
})

export type TruncatedNormalFixture = Schema.Schema.Type<typeof TruncatedNormalFixture>

const ReplayConfig = PromptCategoricalConfig

export type ReplayConfig = Schema.Schema.Type<typeof ReplayConfig>

const TpeReplaySampler = Schema.Struct({
  seed: Schema.Finite,
  nStartupTrials: Schema.Finite,
  nEiCandidates: Schema.Finite,
  trials: Schema.Finite
})

export const TpeCategoricalStudyReplayFixture = Schema.Struct({
  fixture: Schema.Literal("tpe-categorical-study.replay"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    sampler: TpeReplaySampler,
    expected: Schema.Struct({
      bestValue: Schema.Finite,
      configTrace: Schema.Array(ReplayConfig)
    })
  })
})

export type TpeCategoricalStudyReplayFixture = Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixture>

const MixedSpaceTraceName = Schema.Literals([
  "mixed-space.joint-trace",
  "mixed-space.joint-trace.recency-shift"
])

const MixedSpaceTrial = Schema.Struct({
  trialNumber: Schema.Finite,
  config: PrimitiveConfig,
  value: Schema.Finite
})

const MixedSpaceCategoricalDimensionTrace = Schema.Struct({
  kind: Schema.Literal("categorical"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPair),
  candidates: Schema.Array(Choice),
  logL: Schema.Array(Schema.Finite),
  logG: Schema.Array(Schema.Finite),
  scores: Schema.Array(Schema.Finite)
})

const MixedSpaceFloatDimensionTrace = Schema.Struct({
  kind: Schema.Literal("float"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPair),
  candidates: Schema.Array(Schema.Finite),
  logL: Schema.Array(Schema.Finite),
  logG: Schema.Array(Schema.Finite),
  scores: Schema.Array(Schema.Finite)
})

const MixedSpaceIntDimensionTrace = Schema.Struct({
  kind: Schema.Literal("int"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPair),
  candidates: Schema.Array(Schema.Finite),
  logL: Schema.Array(Schema.Finite),
  logG: Schema.Array(Schema.Finite),
  scores: Schema.Array(Schema.Finite)
})

const MixedSpaceDimensionTrace = Schema.Union([
  MixedSpaceCategoricalDimensionTrace,
  MixedSpaceFloatDimensionTrace,
  MixedSpaceIntDimensionTrace
])

const MixedSpaceSearchSpace = Schema.Struct({
  optimizer: Schema.Struct({
    type: Schema.Literal("categorical"),
    choices: Schema.Array(Choice)
  }),
  lr: Schema.Struct({
    type: Schema.Literal("float"),
    low: Schema.Finite,
    high: Schema.Finite,
    scale: Schema.Literals(["linear", "log"]),
    step: Schema.optional(Schema.Finite)
  }),
  depth: Schema.Struct({
    type: Schema.Literal("int"),
    low: Schema.Finite,
    high: Schema.Finite,
    step: Schema.Finite
  })
})

const MixedSpaceSampler = Schema.Struct({
  seed: Schema.Finite,
  nStartupTrials: Schema.Finite,
  nEiCandidates: Schema.Finite,
  nextTrialNumber: Schema.Finite
})

const MixedSpaceExpected = Schema.Struct({
  candidateConfigs: Schema.Array(PrimitiveConfig),
  jointScores: Schema.Array(Schema.Finite),
  expectedBestIndex: Schema.Finite,
  expectedSuggestion: PrimitiveConfig
})

export const MixedSpaceJointTraceFixture = Schema.Struct({
  fixture: MixedSpaceTraceName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    space: MixedSpaceSearchSpace,
    sampler: MixedSpaceSampler,
    split: Schema.Struct({
      below: Schema.Array(MixedSpaceTrial),
      above: Schema.Array(MixedSpaceTrial)
    }),
    dimensions: Schema.Array(MixedSpaceDimensionTrace),
    expected: MixedSpaceExpected
  })
})

export type MixedSpaceJointTraceFixture = Schema.Schema.Type<typeof MixedSpaceJointTraceFixture>

const MotpeSplitTrial = Schema.Struct({
  trialNumber: Schema.Finite,
  values: ObjectivePoint,
  rank: Schema.Finite
})

export const MotpeSplitFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-split.multi-rank-hssp"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    directions: Schema.Array(Direction),
    nBelow: Schema.Finite,
    trials: Schema.Array(MotpeSplitTrial),
    expectedBelow: Schema.Array(Schema.Finite),
    expectedAbove: Schema.Array(Schema.Finite)
  })
})

export type MotpeSplitFixture = Schema.Schema.Type<typeof MotpeSplitFixture>

const MotpeReferenceCase = Schema.Struct({
  id: Schema.String,
  directions: Schema.Array(Direction),
  worstPoint: ObjectivePoint,
  expectedReferencePoint: ObjectivePoint
})

export const MotpeReferenceFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-reference.reference-point"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    epsilon: Schema.Finite,
    cases: Schema.Array(MotpeReferenceCase)
  })
})

export type MotpeReferenceFixture = Schema.Schema.Type<typeof MotpeReferenceFixture>

const MotpeWeightsFixtureName = Schema.Literals([
  "motpe-weights.2obj",
  "motpe-weights.mixed-directions",
  "motpe-weights.zero-contribution"
])

export const MotpeWeightsFixture = Schema.Struct({
  fixture: MotpeWeightsFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    directions: Schema.Array(Direction),
    points: Schema.Array(ObjectivePoint),
    referencePoint: ObjectivePoint,
    expectedContributions: Schema.Array(Schema.Finite),
    expectedWeights: Schema.Array(Schema.Finite)
  })
})

export type MotpeWeightsFixture = Schema.Schema.Type<typeof MotpeWeightsFixture>

export const MotpeStudyFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-study.2obj"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    sampler: TpeReplaySampler,
    directions: Schema.Array(Direction),
    expected: Schema.Struct({
      paretoTrialNumbers: Schema.Array(Schema.Finite),
      paretoValues: Schema.Array(ObjectivePoint),
      configTrace: Schema.Array(ReplayConfig)
    })
  })
})

export type MotpeStudyFixture = Schema.Schema.Type<typeof MotpeStudyFixture>

const ConstrainedDensityCase = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Array(Schema.Finite)),
  probes: Schema.Array(Schema.Array(Schema.Finite)),
  bounds: Schema.Array(Schema.Struct({ low: Schema.Finite, high: Schema.Finite })),
  expectedLogDensities: Schema.Array(Schema.Struct({
    feasible: Schema.Array(Schema.Finite),
    infeasible: Schema.Array(Schema.Finite)
  }))
})

const ConstrainedSplitTrial = Schema.Struct({
  trialNumber: Schema.Finite,
  value: Schema.Finite,
  constraints: Schema.Array(Schema.Finite)
})

const ConstrainedSplitCase = Schema.Struct({
  direction: Direction,
  nBelow: Schema.Finite,
  trials: Schema.Array(ConstrainedSplitTrial),
  expectedBelow: Schema.Array(Schema.Finite),
  expectedAbove: Schema.Array(Schema.Finite)
})

export const ConstrainedTpeFixture = Schema.Struct({
  fixture: Schema.Literal("constrained-tpe.parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    densityCases: Schema.Array(ConstrainedDensityCase),
    splitCases: Schema.Array(ConstrainedSplitCase)
  })
})

export type ConstrainedTpeFixture = Schema.Schema.Type<typeof ConstrainedTpeFixture>

const ConditionalFilteringCase = Schema.Struct({
  id: Schema.String,
  requiredParams: Schema.Array(Schema.String),
  trials: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Finite,
      params: PrimitiveConfig
    })
  ),
  expectedIncluded: Schema.Array(Schema.Finite),
  expectedExcluded: Schema.Array(Schema.Finite)
})

export const ConditionalFilteringFixture = Schema.Struct({
  fixture: Schema.Literal("conditional.filtering"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(ConditionalFilteringCase)
  })
})

export type ConditionalFilteringFixture = Schema.Schema.Type<typeof ConditionalFilteringFixture>

const ConditionalGroup = Schema.Struct({
  key: Schema.String,
  dimensions: Schema.Array(Schema.String)
})

export const ConditionalGroupDecompositionFixture = Schema.Struct({
  fixture: Schema.Literal("conditional.group-decomposition"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    dimensions: Schema.Array(Schema.String),
    additions: Schema.Array(Schema.Array(Schema.String)),
    expectedGroups: Schema.Array(ConditionalGroup)
  })
})

export type ConditionalGroupDecompositionFixture = Schema.Schema.Type<
  typeof ConditionalGroupDecompositionFixture
>

const PruningReportCase = Schema.Struct({
  id: Schema.String,
  initialReports: Schema.Array(IntermediateValue),
  reportAttempt: IntermediateValue,
  expectedReports: Schema.Array(IntermediateValue),
  expectedOutcome: Schema.Literals(["accepted", "duplicate-ignored", "error"]),
  expectedErrorTag: Schema.optional(Schema.Literals(["InvalidReportStep", "InvalidReportValue"]))
})

export const PruningReportContractFixture = Schema.Struct({
  fixture: Schema.Literal("pruning.report-contract"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(PruningReportCase)
  })
})

export type PruningReportContractFixture = Schema.Schema.Type<typeof PruningReportContractFixture>

const PercentilePrunerCase = Schema.Struct({
  id: Schema.String,
  settings: PercentileOptions,
  trialNumber: Schema.Finite,
  step: Schema.Finite,
  currentValue: Schema.Finite,
  history: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Finite,
      state: PercentileTrialState,
      reports: Schema.Array(IntermediateValue)
    })
  ),
  expectedShouldPrune: Schema.Boolean
})

export const PercentilePrunerFixture = Schema.Struct({
  fixture: Schema.Literal("pruning.percentile-pruner"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    direction: Direction,
    cases: Schema.Array(PercentilePrunerCase)
  })
})

export type PercentilePrunerFixture = Schema.Schema.Type<typeof PercentilePrunerFixture>

const AdvancedSamplerSpace = Schema.Struct({
  x: Schema.Struct({ low: Schema.Finite, high: Schema.Finite }),
  y: Schema.Struct({ low: Schema.Finite, high: Schema.Finite })
})

const AdvancedSamplerContext = Schema.Struct({
  nextTrialNumber: Schema.Finite,
  completed: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Finite,
      config: Schema.Struct({
        x: Schema.Finite,
        y: Schema.Finite
      }),
      value: Schema.Finite
    })
  )
})

export const AdvancedCmaEsFixture = Schema.Struct({
  fixture: Schema.Literal("advanced-samplers.cmaes-parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    space: AdvancedSamplerSpace,
    context: AdvancedSamplerContext,
    sampler: Schema.Struct({
      seed: Schema.Finite,
      sigma: Schema.Finite,
      populationSize: Schema.Finite
    }),
    expected: Schema.Struct({
      x: Schema.Finite,
      y: Schema.Finite
    })
  })
})

export type AdvancedCmaEsFixture = Schema.Schema.Type<typeof AdvancedCmaEsFixture>

export const AdvancedGpBoFixture = Schema.Struct({
  fixture: Schema.Literal("advanced-samplers.gpbo-parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    space: AdvancedSamplerSpace,
    context: AdvancedSamplerContext,
    sampler: Schema.Struct({
      seed: Schema.Finite,
      nStartupTrials: Schema.Finite
    }),
    expected: Schema.Struct({
      x: Schema.Finite,
      y: Schema.Finite
    })
  })
})

export type AdvancedGpBoFixture = Schema.Schema.Type<typeof AdvancedGpBoFixture>

const ReportPoint = Schema.Struct({ step: Schema.Finite, value: Schema.Finite })

export const TrialStatesConstantLiarFixture = Schema.Struct({
  fixture: Schema.Literal("trial-states.constant-liar"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    direction: Direction,
    choices: Schema.Array(Schema.String),
    nStartupTrials: Schema.Finite,
    multivariate: Schema.Boolean,
    completed: Schema.Array(Schema.Struct({ trialNumber: Schema.Finite, x: Schema.String, value: Schema.Finite })),
    running: Schema.Struct({ trialNumber: Schema.Finite, x: Schema.String }),
    seeds: Schema.Array(Schema.Finite),
    expected: Schema.Struct({
      defaultConstantLiar: Schema.Boolean,
      withoutRunning: Schema.Array(Schema.String),
      runningDefault: Schema.Array(Schema.String),
      runningConstantLiar: Schema.Array(Schema.String)
    })
  })
})

export type TrialStatesConstantLiarFixture = Schema.Schema.Type<typeof TrialStatesConstantLiarFixture>

export const TrialStatesPrunedConstraintsFixture = Schema.Struct({
  fixture: Schema.Literal("trial-states.pruned-constraints"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      id: Schema.String,
      direction: Direction,
      constraintParams: Schema.Array(Schema.String),
      nBelow: Schema.Finite,
      trials: Schema.Array(Schema.Struct({
        trialNumber: Schema.Finite,
        state: Schema.Literals(["complete", "pruned"]),
        params: Schema.Record(Schema.String, Schema.Finite),
        value: Schema.optional(Schema.Finite),
        reports: Schema.Array(ReportPoint),
        constraints: Schema.Array(Schema.Finite)
      })),
      expectedBelow: Schema.Array(Schema.Finite),
      expectedAbove: Schema.Array(Schema.Finite)
    }))
  })
})

export type TrialStatesPrunedConstraintsFixture = Schema.Schema.Type<typeof TrialStatesPrunedConstraintsFixture>

export const TrialStatesThresholdFixture = Schema.Struct({
  fixture: Schema.Literal("trial-states.threshold-last-step"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      id: Schema.String,
      direction: Direction,
      limit: Schema.Finite,
      warmupSteps: Schema.Finite,
      reports: Schema.Array(ReportPoint),
      expectedShouldPrune: Schema.Array(Schema.Boolean),
      expectedLastStep: Schema.Finite
    }))
  })
})

export type TrialStatesThresholdFixture = Schema.Schema.Type<typeof TrialStatesThresholdFixture>

const MotpeHsspPointsCase = Schema.Struct({
  id: Schema.String,
  directions: Schema.Array(Direction),
  nBelow: Schema.Finite,
  points: Schema.Array(ObjectivePoint),
  expectedBelow: Schema.Array(Schema.Finite)
})

export const MotpeHsspTiesFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-hssp.ties"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(MotpeHsspPointsCase.mapFields((fields) => ({
      ...fields,
      expectedAbove: Schema.Array(Schema.Finite)
    })))
  })
})

export type MotpeHsspTiesFixture = Schema.Schema.Type<typeof MotpeHsspTiesFixture>

export const MotpeHsspManyObjectiveFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-hssp.many-objective"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({ cases: Schema.Array(MotpeHsspPointsCase) })
})

export type MotpeHsspManyObjectiveFixture = Schema.Schema.Type<typeof MotpeHsspManyObjectiveFixture>

const ConstrainedObjectiveTrial = Schema.Struct({
  trialNumber: Schema.Finite,
  values: ObjectivePoint,
  constraints: Schema.Array(Schema.Finite)
})

export const MotpeHsspFeasibilityFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-hssp.feasibility-fronts"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      id: Schema.String,
      directions: Schema.Array(Direction),
      nBelow: Schema.Finite,
      trials: Schema.Array(ConstrainedObjectiveTrial),
      expectedBelow: Schema.Array(Schema.Finite),
      expectedAbove: Schema.Array(Schema.Finite)
    }))
  })
})

export type MotpeHsspFeasibilityFixture = Schema.Schema.Type<typeof MotpeHsspFeasibilityFixture>

export const MotpeHsspBelowWeightsFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-hssp.below-weights"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      id: Schema.String,
      directions: Schema.Array(Direction),
      trials: Schema.Array(ConstrainedObjectiveTrial),
      expectedWeights: Schema.Array(Schema.Finite)
    }))
  })
})

export type MotpeHsspBelowWeightsFixture = Schema.Schema.Type<typeof MotpeHsspBelowWeightsFixture>

const SelectionGap = Schema.OptionFromNullOr(Schema.Finite)

export const TpeNumericSteppedFloatFixture = Schema.Struct({
  fixture: Schema.Literal("tpe-numeric.stepped-float"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    space: Schema.Struct({ low: Schema.Finite, high: Schema.Finite, step: Schema.Finite }),
    sampler: Schema.Struct({ nStartupTrials: Schema.Finite, multivariate: Schema.Boolean }),
    history: Schema.Array(Schema.Struct({ trialNumber: Schema.Finite, x: Schema.Finite, value: Schema.Finite })),
    nearTie: Schema.Finite,
    runs: Schema.Array(Schema.Struct({
      nEiCandidates: Schema.Finite,
      expected: Schema.Array(Schema.Struct({ seed: Schema.Finite, selected: Schema.Finite, gap: SelectionGap }))
    }))
  })
})

export type TpeNumericSteppedFloatFixture = Schema.Schema.Type<typeof TpeNumericSteppedFloatFixture>

export const TpeNumericMixedDefaultFixture = Schema.Struct({
  fixture: Schema.Literal("tpe-numeric.mixed-default"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    sampler: Schema.Struct({
      nStartupTrials: Schema.Finite,
      nEiCandidates: Schema.Finite,
      multivariate: Schema.Boolean
    }),
    categoryCost: Schema.Record(Schema.String, Schema.Finite),
    nearTie: Schema.Finite,
    runs: Schema.Array(Schema.Struct({
      space: Schema.Literals(["float-int", "step-log-categorical"]),
      seed: Schema.Finite,
      trace: Schema.Array(Schema.Struct({ number: Schema.Finite, params: PrimitiveConfig, value: Schema.Finite })),
      gaps: Schema.Array(Schema.Array(SelectionGap)),
      strictThroughTrial: Schema.Finite
    }))
  })
})

export type TpeNumericMixedDefaultFixture = Schema.Schema.Type<typeof TpeNumericMixedDefaultFixture>

export const FixtureName = Schema.Literals([
  "gamma.default-gamma",
  "split-trials.single-and-liar",
  "pruned-score.pruned-ordering",
  "motpe-split.multi-rank-hssp",
  "motpe-reference.reference-point",
  "categorical-parzen.basic",
  "categorical-parzen.distance",
  "categorical-parzen.recency-ramp",
  "continuous-kde.basic",
  "continuous-kde.bimodal-separated",
  "continuous-kde.boundary-high-skew",
  "continuous-kde.boundary-low-skew",
  "continuous-kde.endpoint-observations",
  "continuous-kde.extreme-asymmetric-range",
  "continuous-kde.magic-clip",
  "continuous-kde.micro-positive-span",
  "continuous-kde.narrow-support",
  "continuous-kde.offset-positive-range",
  "continuous-kde.outlier-cluster",
  "continuous-kde.prior-only",
  "continuous-kde.repeated-support-point",
  "continuous-kde.recency-ramp",
  "continuous-kde.single-observation",
  "continuous-kde.tiny-cross-zero-span",
  "continuous-kde.upper-boundary-cluster",
  "continuous-kde.wide-negative-range",
  "noise-bandwidth.parity",
  "multivariate-gaussian.parity",
  "truncated-normal.edge-cases",
  "ei.basic",
  "ei.mixed-trace",
  "mixed-space.joint-trace",
  "mixed-space.joint-trace.recency-shift",
  "conditional.filtering",
  "conditional.group-decomposition",
  "pruning.report-contract",
  "pruning.percentile-pruner",
  "tpe-categorical-study.replay",
  "motpe-weights.2obj",
  "motpe-weights.mixed-directions",
  "motpe-weights.zero-contribution",
  "motpe-study.2obj",
  "constrained-tpe.parity",
  "advanced-samplers.cmaes-parity",
  "advanced-samplers.gpbo-parity",
  "trial-states.constant-liar",
  "trial-states.pruned-constraints",
  "trial-states.threshold-last-step",
  "motpe-hssp.ties",
  "motpe-hssp.feasibility-fronts",
  "motpe-hssp.many-objective",
  "motpe-hssp.below-weights",
  "tpe-numeric.stepped-float",
  "tpe-numeric.mixed-default"
])

export type FixtureName = Schema.Schema.Type<typeof FixtureName>

export const FixtureManifestEntry = Schema.Struct({
  name: FixtureName,
  file: Schema.String
})

export type FixtureManifestEntry = Schema.Schema.Type<typeof FixtureManifestEntry>

export const FixtureManifest = Schema.Struct({
  generator: Schema.String,
  upstream: Schema.Struct({
    optuna: Schema.Literal("4.9.0"),
    python: Schema.String,
    platform: Schema.String
  }),
  fixtures: Schema.Array(FixtureManifestEntry)
})

export type FixtureManifest = Schema.Schema.Type<typeof FixtureManifest>

export const KnownFixture = Schema.Union([
  GammaFixture,
  SplitTrialsFixture,
  PrunedScoreFixture,
  MotpeSplitFixture,
  MotpeReferenceFixture,
  CategoricalParzenFixture,
  EiCategoricalFixture,
  ContinuousKdeFixture,
  NoiseBandwidthFixture,
  TruncatedNormalFixture,
  MultivariateGaussianFixture,
  MixedSpaceJointTraceFixture,
  ConditionalFilteringFixture,
  ConditionalGroupDecompositionFixture,
  PruningReportContractFixture,
  PercentilePrunerFixture,
  TpeCategoricalStudyReplayFixture,
  MotpeWeightsFixture,
  MotpeStudyFixture,
  ConstrainedTpeFixture,
  AdvancedCmaEsFixture,
  AdvancedGpBoFixture,
  TrialStatesConstantLiarFixture,
  TrialStatesPrunedConstraintsFixture,
  TrialStatesThresholdFixture,
  MotpeHsspTiesFixture,
  MotpeHsspFeasibilityFixture,
  MotpeHsspManyObjectiveFixture,
  MotpeHsspBelowWeightsFixture,
  TpeNumericSteppedFloatFixture,
  TpeNumericMixedDefaultFixture
])

export type KnownFixture = Schema.Schema.Type<typeof KnownFixture>
