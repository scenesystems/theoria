import { Schema } from "effect"

import { Name } from "../../../src/Acquisition.js"
import { Direction } from "../../../src/Direction.js"
import { Choice } from "../../../src/Distribution.js"
import { CandidateRollPair } from "../../../src/internal/tpe/dimensions/trace.js"
import { PercentileOptions, PercentileTrialState } from "../../../src/Pruning.js"
import { PromptCategoricalConfig } from "../../fixtures/scenarios/promptCategorical.js"

const FixtureMetadata = Schema.Struct({
  generatedAt: Schema.String,
  upstream: Schema.Struct({
    name: Schema.Literal("optuna"),
    version: Schema.String
  }),
  generator: Schema.Struct({
    script: Schema.String,
    version: Schema.String
  })
})

const NumericSentinel = Schema.Literal("NaN", "Infinity", "-Infinity")

const NumericTraceValue = Schema.Union(Schema.Number, NumericSentinel)

const IntermediateValue = Schema.Struct({
  step: Schema.Number,
  value: NumericTraceValue
})

const PrimitiveConfig = Schema.Record({
  key: Schema.String,
  value: Choice
})

const ObjectivePoint = Schema.Array(Schema.Number)

const CategoricalParzenFixtureName = Schema.Literal(
  "categorical-parzen.basic",
  "categorical-parzen.distance",
  "categorical-parzen.recency-ramp"
)

const CategoricalDistanceMetric = Schema.Literal("absolute")

const CategoricalParzenExpected = Schema.Struct({
  kernelWeights: Schema.Array(Schema.Number),
  probabilities: Schema.Array(Schema.Number),
  kernels: Schema.Array(Schema.Array(Schema.Number)),
  candidateRolls: Schema.Array(Schema.Number),
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
  nTrials: Schema.Number,
  defaultGamma: Schema.Number,
  hyperoptGamma: Schema.Number
})

export const GammaFixture = Schema.Struct({
  fixture: Schema.Literal("gamma.default-gamma"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    cap: Schema.Number,
    cases: Schema.Array(GammaCase)
  })
})

export type GammaFixture = Schema.Schema.Type<typeof GammaFixture>

const SplitTrial = Schema.Struct({
  trialNumber: Schema.Number,
  state: Schema.Literal("complete", "pruned", "running"),
  value: Schema.optional(NumericTraceValue),
  intermediateValues: Schema.Array(IntermediateValue),
  liarValue: Schema.optional(NumericTraceValue),
  isFeasible: Schema.optional(Schema.Boolean)
})

const SplitTrialsCase = Schema.Struct({
  id: Schema.String,
  direction: Direction,
  nBelow: Schema.Number,
  trials: Schema.Array(SplitTrial),
  expectedBelow: Schema.Array(Schema.Number),
  expectedAbove: Schema.Array(Schema.Number)
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
  trialNumber: Schema.Number,
  intermediateValues: Schema.Array(IntermediateValue),
  expectedStep: Schema.Number,
  expectedScore: NumericTraceValue
})

export const PrunedScoreFixture = Schema.Struct({
  fixture: Schema.Literal("pruned-score.pruned-ordering"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    direction: Direction,
    cases: Schema.Array(PrunedScoreCase),
    expectedOrder: Schema.Array(Schema.Number)
  })
})

export type PrunedScoreFixture = Schema.Schema.Type<typeof PrunedScoreFixture>

const EiFixtureName = Schema.Literal("ei.basic", "ei.mixed-trace")

const EiScoreTrace = Schema.Struct({
  candidate: Schema.String,
  logL: Schema.Number,
  logG: Schema.Number,
  expected: Schema.Number
})

export const EiCategoricalFixture = Schema.Struct({
  fixture: EiFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    scoreTrace: Schema.Array(EiScoreTrace),
    scoreVector: Schema.Array(Schema.Number),
    expectedBestIndex: Schema.Number
  })
})

export type EiCategoricalFixture = Schema.Schema.Type<typeof EiCategoricalFixture>

const ContinuousKernelExpectation = Schema.Struct({
  mean: Schema.Number,
  sigma: Schema.Number,
  weight: Schema.Number
})

const ContinuousKdeFixtureName = Schema.Literal(
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
)

const ContinuousLogDensityTrace = Schema.Struct({
  probe: Schema.Number,
  expected: Schema.Number
})

const ContinuousExpected = Schema.Struct({
  kernels: Schema.Array(ContinuousKernelExpectation),
  logDensities: Schema.Array(ContinuousLogDensityTrace),
  candidateRolls: Schema.Array(CandidateRollPair),
  expectedSamples: Schema.Array(Schema.Number)
})

export const ContinuousKdeFixture = Schema.Struct({
  fixture: ContinuousKdeFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    observations: Schema.Array(Schema.Number),
    low: Schema.Number,
    high: Schema.Number,
    expected: ContinuousExpected
  })
})

export type ContinuousKdeFixture = Schema.Schema.Type<typeof ContinuousKdeFixture>

const NoiseBandwidthExpected = Schema.Struct({
  baseSigmas: Schema.Array(Schema.Number),
  normalizedNoise: Schema.Number,
  bandwidthScale: Schema.Number,
  adjustedSigmas: Schema.Array(Schema.Number)
})

const NoiseBandwidthCase = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Number),
  low: Schema.Number,
  high: Schema.Number,
  alpha: Schema.Number,
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
  point: Schema.Array(Schema.Number),
  mean: Schema.Array(Schema.Number),
  sigmas: Schema.Array(Schema.Number),
  expectedLogDensity: Schema.Number
})

const MultivariateGaussianBandwidthCase = Schema.Struct({
  id: Schema.String,
  sampleCount: Schema.Number,
  dimensions: Schema.Number,
  stddev: Schema.Number,
  expectedFactor: Schema.Number,
  expectedBandwidth: Schema.Number
})

const MultivariateGaussianSamplingCase = Schema.Struct({
  id: Schema.String,
  mean: Schema.Array(Schema.Number),
  sigmas: Schema.Array(Schema.Number),
  rolls: Schema.Array(Schema.Number),
  expectedSample: Schema.Array(Schema.Number)
})

const MultivariateGaussianMixtureCase = Schema.Struct({
  means: Schema.Array(Schema.Array(Schema.Number)),
  sigmas: Schema.Array(Schema.Array(Schema.Number)),
  weights: Schema.Array(Schema.Number),
  componentRoll: Schema.Number,
  valueRolls: Schema.Array(Schema.Number),
  expectedSample: Schema.Array(Schema.Number),
  expectedLogDensity: Schema.Number
})

export const MultivariateGaussianFixture = Schema.Struct({
  fixture: Schema.Literal("multivariate-gaussian.parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    densityCases: Schema.Array(MultivariateGaussianDensityCase),
    bandwidthCases: Schema.Array(MultivariateGaussianBandwidthCase),
    samplingCases: Schema.Array(MultivariateGaussianSamplingCase),
    mixtureCase: MultivariateGaussianMixtureCase
  })
})

export type MultivariateGaussianFixture = Schema.Schema.Type<typeof MultivariateGaussianFixture>

const TruncatedNormalCase = Schema.Struct({
  id: Schema.String,
  params: Schema.Struct({
    mean: Schema.Number,
    sigma: Schema.Number,
    low: Schema.Number,
    high: Schema.Number
  }),
  sampleQuantiles: Schema.Array(Schema.Number),
  sampleExpected: Schema.Array(Schema.Number),
  cdfProbes: Schema.Array(Schema.Number),
  cdfExpected: Schema.Array(Schema.Number),
  logPdfProbes: Schema.Array(Schema.Number),
  logPdfExpected: Schema.Array(Schema.Number)
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
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  trials: Schema.Number
})

export const TpeCategoricalStudyReplayFixture = Schema.Struct({
  fixture: Schema.Literal("tpe-categorical-study.replay"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    sampler: TpeReplaySampler,
    expected: Schema.Struct({
      bestValue: Schema.Number,
      configTrace: Schema.Array(ReplayConfig)
    })
  })
})

export type TpeCategoricalStudyReplayFixture = Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixture>

const MixedSpaceTraceName = Schema.Literal(
  "mixed-space.joint-trace",
  "mixed-space.joint-trace.recency-shift"
)

const MixedSpaceTrial = Schema.Struct({
  trialNumber: Schema.Number,
  config: PrimitiveConfig,
  value: Schema.Number
})

const MixedSpaceCategoricalDimensionTrace = Schema.Struct({
  kind: Schema.Literal("categorical"),
  name: Schema.String,
  candidateRolls: Schema.Array(Schema.Number),
  candidates: Schema.Array(Choice),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceFloatDimensionTrace = Schema.Struct({
  kind: Schema.Literal("float"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPair),
  candidates: Schema.Array(Schema.Number),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceIntDimensionTrace = Schema.Struct({
  kind: Schema.Literal("int"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPair),
  candidates: Schema.Array(Schema.Number),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceDimensionTrace = Schema.Union(
  MixedSpaceCategoricalDimensionTrace,
  MixedSpaceFloatDimensionTrace,
  MixedSpaceIntDimensionTrace
)

const MixedSpaceSearchSpace = Schema.Struct({
  optimizer: Schema.Struct({
    type: Schema.Literal("categorical"),
    choices: Schema.Array(Choice)
  }),
  lr: Schema.Struct({
    type: Schema.Literal("float"),
    low: Schema.Number,
    high: Schema.Number,
    scale: Schema.Literal("linear", "log"),
    step: Schema.optional(Schema.Number)
  }),
  depth: Schema.Struct({
    type: Schema.Literal("int"),
    low: Schema.Number,
    high: Schema.Number,
    step: Schema.Number
  })
})

const MixedSpaceSampler = Schema.Struct({
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  nextTrialNumber: Schema.Number
})

const MixedSpaceExpected = Schema.Struct({
  candidateConfigs: Schema.Array(PrimitiveConfig),
  jointScores: Schema.Array(Schema.Number),
  expectedBestIndex: Schema.Number,
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
  trialNumber: Schema.Number,
  values: ObjectivePoint,
  feasible: Schema.Boolean,
  rank: Schema.Number,
  hsspScore: Schema.Number
})

export const MotpeSplitFixture = Schema.Struct({
  fixture: Schema.Literal("motpe-split.multi-rank-hssp"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    directions: Schema.Array(Direction),
    nBelow: Schema.Number,
    trials: Schema.Array(MotpeSplitTrial),
    expectedBelow: Schema.Array(Schema.Number),
    expectedAbove: Schema.Array(Schema.Number)
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
    epsilon: Schema.Number,
    cases: Schema.Array(MotpeReferenceCase)
  })
})

export type MotpeReferenceFixture = Schema.Schema.Type<typeof MotpeReferenceFixture>

const MotpeWeightsFixtureName = Schema.Literal(
  "motpe-weights.2obj",
  "motpe-weights.mixed-directions",
  "motpe-weights.zero-contribution"
)

export const MotpeWeightsFixture = Schema.Struct({
  fixture: MotpeWeightsFixtureName,
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    directions: Schema.Array(Direction),
    points: Schema.Array(ObjectivePoint),
    referencePoint: ObjectivePoint,
    expectedContributions: Schema.Array(Schema.Number),
    expectedWeights: Schema.Array(Schema.Number)
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
      paretoTrialNumbers: Schema.Array(Schema.Number),
      paretoValues: Schema.Array(ObjectivePoint),
      configTrace: Schema.Array(ReplayConfig)
    })
  })
})

export type MotpeStudyFixture = Schema.Schema.Type<typeof MotpeStudyFixture>

const ConstrainedDensityCase = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Array(Schema.Number)),
  probes: Schema.Array(Schema.Array(Schema.Number)),
  expectedRatioProducts: Schema.Array(Schema.Number),
  expectedOrder: Schema.Array(Schema.Number)
})

const ConstrainedSplitTrial = Schema.Struct({
  trialNumber: Schema.Number,
  value: Schema.Number,
  constraints: Schema.Array(Schema.Number)
})

const ConstrainedSplitCase = Schema.Struct({
  direction: Direction,
  nBelow: Schema.Number,
  trials: Schema.Array(ConstrainedSplitTrial),
  expectedBelow: Schema.Array(Schema.Number),
  expectedAbove: Schema.Array(Schema.Number)
})

export const ConstrainedTpeFixture = Schema.Struct({
  fixture: Schema.Literal("constrained-tpe.parity"),
  metadata: FixtureMetadata,
  payload: Schema.Struct({
    densityCases: Schema.Array(ConstrainedDensityCase),
    splitCase: ConstrainedSplitCase
  })
})

export type ConstrainedTpeFixture = Schema.Schema.Type<typeof ConstrainedTpeFixture>

const ConditionalFilteringCase = Schema.Struct({
  id: Schema.String,
  requiredParams: Schema.Array(Schema.String),
  trials: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Number,
      params: PrimitiveConfig
    })
  ),
  expectedIncluded: Schema.Array(Schema.Number),
  expectedExcluded: Schema.Array(Schema.Number)
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
  expectedOutcome: Schema.Literal("accepted", "duplicate-ignored", "error"),
  expectedErrorTag: Schema.optional(Schema.Literal("InvalidReportStep", "InvalidReportValue"))
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
  trialNumber: Schema.Number,
  step: Schema.Number,
  currentValue: Schema.Number,
  history: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Number,
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
  x: Schema.Struct({ low: Schema.Number, high: Schema.Number }),
  y: Schema.Struct({ low: Schema.Number, high: Schema.Number })
})

const AdvancedSamplerContext = Schema.Struct({
  nextTrialNumber: Schema.Number,
  completed: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Number,
      config: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number
      }),
      value: Schema.Number
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
      seed: Schema.Number,
      sigma: Schema.Number,
      populationSize: Schema.Number
    }),
    expected: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number
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
      seed: Schema.Number,
      nStartupTrials: Schema.Number,
      nCandidates: Schema.Number,
      lengthScale: Schema.Number,
      noise: Schema.Number,
      acquisition: Name
    }),
    expected: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number
    })
  })
})

export type AdvancedGpBoFixture = Schema.Schema.Type<typeof AdvancedGpBoFixture>

export const FixtureName = Schema.Literal(
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
  "advanced-samplers.gpbo-parity"
)

export type FixtureName = Schema.Schema.Type<typeof FixtureName>

const FixtureManifestGenerator = Schema.Struct({
  script: Schema.String,
  generatorVersion: Schema.String,
  upstream: Schema.Literal("optuna"),
  upstreamVersion: Schema.String,
  pythonVersion: Schema.String,
  generatedAt: Schema.String
})

export const FixtureManifestEntry = Schema.Struct({
  name: FixtureName,
  file: Schema.String
})

export type FixtureManifestEntry = Schema.Schema.Type<typeof FixtureManifestEntry>

export const FixtureManifest = Schema.Struct({
  generator: FixtureManifestGenerator,
  fixtures: Schema.Array(FixtureManifestEntry)
})

export type FixtureManifest = Schema.Schema.Type<typeof FixtureManifest>

export const KnownFixture = Schema.Union(
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
  AdvancedGpBoFixture
)

export type KnownFixture = Schema.Schema.Type<typeof KnownFixture>
