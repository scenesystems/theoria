import { Schema } from "effect"

import { DirectionSchema } from "../../../src/contracts/Direction.js"
import { PrimitiveChoiceSchema } from "../../../src/contracts/Distribution.js"
import { PromptCategoricalConfigSchema } from "../../../src/experimental/scenarios/promptCategorical.js"
import { CandidateRollPairSchema } from "../../../src/samplers/Tpe/dimensions/trace.js"
import {
  PercentilePrunerSettingsSchema,
  PercentilePrunerTrialStateSchema
} from "../../../src/Study/runtime/percentilePruning.js"

const FixtureMetadataSchema = Schema.Struct({
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

const NumericSentinelSchema = Schema.Literal("NaN", "Infinity", "-Infinity")

const NumericTraceValueSchema = Schema.Union(Schema.Number, NumericSentinelSchema)

const IntermediateValueSchema = Schema.Struct({
  step: Schema.Number,
  value: NumericTraceValueSchema
})

const PrimitiveConfigSchema = Schema.Record({
  key: Schema.String,
  value: PrimitiveChoiceSchema
})

const ObjectivePointSchema = Schema.Array(Schema.Number)

const CategoricalParzenFixtureNameSchema = Schema.Literal(
  "categorical-parzen.basic",
  "categorical-parzen.distance",
  "categorical-parzen.recency-ramp"
)

const CategoricalDistanceMetricSchema = Schema.Literal("absolute")

const CategoricalParzenExpectedSchema = Schema.Struct({
  kernelWeights: Schema.Array(Schema.Number),
  probabilities: Schema.Array(Schema.Number),
  kernels: Schema.Array(Schema.Array(Schema.Number)),
  candidateRolls: Schema.Array(Schema.Number),
  expectedCandidates: Schema.Array(PrimitiveChoiceSchema)
})

export const CategoricalParzenFixtureSchema = Schema.Struct({
  fixture: CategoricalParzenFixtureNameSchema,
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    choices: Schema.Array(PrimitiveChoiceSchema),
    observations: Schema.Array(PrimitiveChoiceSchema),
    distanceMetric: Schema.optional(CategoricalDistanceMetricSchema),
    expected: CategoricalParzenExpectedSchema
  })
})

export type CategoricalParzenFixture = Schema.Schema.Type<typeof CategoricalParzenFixtureSchema>

const GammaCaseSchema = Schema.Struct({
  nTrials: Schema.Number,
  defaultGamma: Schema.Number,
  hyperoptGamma: Schema.Number
})

export const GammaFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("gamma.default-gamma"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cap: Schema.Number,
    cases: Schema.Array(GammaCaseSchema)
  })
})

export type GammaFixture = Schema.Schema.Type<typeof GammaFixtureSchema>

const SplitTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  state: Schema.Literal("complete", "pruned", "running"),
  value: Schema.optional(NumericTraceValueSchema),
  intermediateValues: Schema.Array(IntermediateValueSchema),
  liarValue: Schema.optional(NumericTraceValueSchema),
  isFeasible: Schema.optional(Schema.Boolean)
})

const SplitTrialsCaseSchema = Schema.Struct({
  id: Schema.String,
  direction: DirectionSchema,
  nBelow: Schema.Number,
  trials: Schema.Array(SplitTrialSchema),
  expectedBelow: Schema.Array(Schema.Number),
  expectedAbove: Schema.Array(Schema.Number)
})

export const SplitTrialsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("split-trials.single-and-liar"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(SplitTrialsCaseSchema)
  })
})

export type SplitTrialsFixture = Schema.Schema.Type<typeof SplitTrialsFixtureSchema>

const PrunedScoreCaseSchema = Schema.Struct({
  id: Schema.String,
  trialNumber: Schema.Number,
  intermediateValues: Schema.Array(IntermediateValueSchema),
  expectedStep: Schema.Number,
  expectedScore: NumericTraceValueSchema
})

export const PrunedScoreFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("pruned-score.pruned-ordering"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    direction: DirectionSchema,
    cases: Schema.Array(PrunedScoreCaseSchema),
    expectedOrder: Schema.Array(Schema.Number)
  })
})

export type PrunedScoreFixture = Schema.Schema.Type<typeof PrunedScoreFixtureSchema>

const EiFixtureNameSchema = Schema.Literal("ei.basic", "ei.mixed-trace")

const EiScoreTraceSchema = Schema.Struct({
  candidate: Schema.String,
  logL: Schema.Number,
  logG: Schema.Number,
  expected: Schema.Number
})

export const EiCategoricalFixtureSchema = Schema.Struct({
  fixture: EiFixtureNameSchema,
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    scoreTrace: Schema.Array(EiScoreTraceSchema),
    scoreVector: Schema.Array(Schema.Number),
    expectedBestIndex: Schema.Number
  })
})

export type EiCategoricalFixture = Schema.Schema.Type<typeof EiCategoricalFixtureSchema>

const ContinuousKernelExpectationSchema = Schema.Struct({
  mean: Schema.Number,
  sigma: Schema.Number,
  weight: Schema.Number
})

const ContinuousKdeFixtureNameSchema = Schema.Literal(
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

const ContinuousLogDensityTraceSchema = Schema.Struct({
  probe: Schema.Number,
  expected: Schema.Number
})

const ContinuousExpectedSchema = Schema.Struct({
  kernels: Schema.Array(ContinuousKernelExpectationSchema),
  logDensities: Schema.Array(ContinuousLogDensityTraceSchema),
  candidateRolls: Schema.Array(CandidateRollPairSchema),
  expectedSamples: Schema.Array(Schema.Number)
})

export const ContinuousKdeFixtureSchema = Schema.Struct({
  fixture: ContinuousKdeFixtureNameSchema,
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    observations: Schema.Array(Schema.Number),
    low: Schema.Number,
    high: Schema.Number,
    expected: ContinuousExpectedSchema
  })
})

export type ContinuousKdeFixture = Schema.Schema.Type<typeof ContinuousKdeFixtureSchema>

const NoiseBandwidthExpectedSchema = Schema.Struct({
  baseSigmas: Schema.Array(Schema.Number),
  normalizedNoise: Schema.Number,
  bandwidthScale: Schema.Number,
  adjustedSigmas: Schema.Array(Schema.Number)
})

const NoiseBandwidthCaseSchema = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Number),
  low: Schema.Number,
  high: Schema.Number,
  alpha: Schema.Number,
  expected: NoiseBandwidthExpectedSchema
})

export const NoiseBandwidthFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("noise-bandwidth.parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(NoiseBandwidthCaseSchema)
  })
})

export type NoiseBandwidthFixture = Schema.Schema.Type<typeof NoiseBandwidthFixtureSchema>

const MultivariateGaussianDensityCaseSchema = Schema.Struct({
  id: Schema.String,
  point: Schema.Array(Schema.Number),
  mean: Schema.Array(Schema.Number),
  sigmas: Schema.Array(Schema.Number),
  expectedLogDensity: Schema.Number
})

const MultivariateGaussianBandwidthCaseSchema = Schema.Struct({
  id: Schema.String,
  sampleCount: Schema.Number,
  dimensions: Schema.Number,
  stddev: Schema.Number,
  expectedFactor: Schema.Number,
  expectedBandwidth: Schema.Number
})

const MultivariateGaussianSamplingCaseSchema = Schema.Struct({
  id: Schema.String,
  mean: Schema.Array(Schema.Number),
  sigmas: Schema.Array(Schema.Number),
  rolls: Schema.Array(Schema.Number),
  expectedSample: Schema.Array(Schema.Number)
})

const MultivariateGaussianMixtureCaseSchema = Schema.Struct({
  means: Schema.Array(Schema.Array(Schema.Number)),
  sigmas: Schema.Array(Schema.Array(Schema.Number)),
  weights: Schema.Array(Schema.Number),
  componentRoll: Schema.Number,
  valueRolls: Schema.Array(Schema.Number),
  expectedSample: Schema.Array(Schema.Number),
  expectedLogDensity: Schema.Number
})

export const MultivariateGaussianFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("multivariate-gaussian.parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    densityCases: Schema.Array(MultivariateGaussianDensityCaseSchema),
    bandwidthCases: Schema.Array(MultivariateGaussianBandwidthCaseSchema),
    samplingCases: Schema.Array(MultivariateGaussianSamplingCaseSchema),
    mixtureCase: MultivariateGaussianMixtureCaseSchema
  })
})

export type MultivariateGaussianFixture = Schema.Schema.Type<typeof MultivariateGaussianFixtureSchema>

const TruncatedNormalCaseSchema = Schema.Struct({
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

export const TruncatedNormalFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("truncated-normal.edge-cases"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(TruncatedNormalCaseSchema)
  })
})

export type TruncatedNormalFixture = Schema.Schema.Type<typeof TruncatedNormalFixtureSchema>

const ReplayConfigSchema = PromptCategoricalConfigSchema

export type ReplayConfig = Schema.Schema.Type<typeof ReplayConfigSchema>

const TpeReplaySamplerSchema = Schema.Struct({
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  trials: Schema.Number
})

export const TpeCategoricalStudyReplayFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("tpe-categorical-study.replay"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    sampler: TpeReplaySamplerSchema,
    expected: Schema.Struct({
      bestValue: Schema.Number,
      configTrace: Schema.Array(ReplayConfigSchema)
    })
  })
})

export type TpeCategoricalStudyReplayFixture = Schema.Schema.Type<typeof TpeCategoricalStudyReplayFixtureSchema>

const MixedSpaceTraceNameSchema = Schema.Literal(
  "mixed-space.joint-trace",
  "mixed-space.joint-trace.recency-shift"
)

const MixedSpaceTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  config: PrimitiveConfigSchema,
  value: Schema.Number
})

const MixedSpaceCategoricalDimensionTraceSchema = Schema.Struct({
  kind: Schema.Literal("categorical"),
  name: Schema.String,
  candidateRolls: Schema.Array(Schema.Number),
  candidates: Schema.Array(PrimitiveChoiceSchema),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceFloatDimensionTraceSchema = Schema.Struct({
  kind: Schema.Literal("float"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPairSchema),
  candidates: Schema.Array(Schema.Number),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceIntDimensionTraceSchema = Schema.Struct({
  kind: Schema.Literal("int"),
  name: Schema.String,
  candidateRolls: Schema.Array(CandidateRollPairSchema),
  candidates: Schema.Array(Schema.Number),
  logL: Schema.Array(Schema.Number),
  logG: Schema.Array(Schema.Number),
  scores: Schema.Array(Schema.Number)
})

const MixedSpaceDimensionTraceSchema = Schema.Union(
  MixedSpaceCategoricalDimensionTraceSchema,
  MixedSpaceFloatDimensionTraceSchema,
  MixedSpaceIntDimensionTraceSchema
)

const MixedSpaceSearchSpaceSchema = Schema.Struct({
  optimizer: Schema.Struct({
    type: Schema.Literal("categorical"),
    choices: Schema.Array(PrimitiveChoiceSchema)
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

const MixedSpaceSamplerSchema = Schema.Struct({
  seed: Schema.Number,
  nStartupTrials: Schema.Number,
  nEiCandidates: Schema.Number,
  nextTrialNumber: Schema.Number
})

const MixedSpaceExpectedSchema = Schema.Struct({
  candidateConfigs: Schema.Array(PrimitiveConfigSchema),
  jointScores: Schema.Array(Schema.Number),
  expectedBestIndex: Schema.Number,
  expectedSuggestion: PrimitiveConfigSchema
})

export const MixedSpaceJointTraceFixtureSchema = Schema.Struct({
  fixture: MixedSpaceTraceNameSchema,
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    space: MixedSpaceSearchSpaceSchema,
    sampler: MixedSpaceSamplerSchema,
    split: Schema.Struct({
      below: Schema.Array(MixedSpaceTrialSchema),
      above: Schema.Array(MixedSpaceTrialSchema)
    }),
    dimensions: Schema.Array(MixedSpaceDimensionTraceSchema),
    expected: MixedSpaceExpectedSchema
  })
})

export type MixedSpaceJointTraceFixture = Schema.Schema.Type<typeof MixedSpaceJointTraceFixtureSchema>

const MotpeSplitTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  values: ObjectivePointSchema,
  feasible: Schema.Boolean,
  rank: Schema.Number,
  hsspScore: Schema.Number
})

export const MotpeSplitFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("motpe-split.multi-rank-hssp"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    directions: Schema.Array(DirectionSchema),
    nBelow: Schema.Number,
    trials: Schema.Array(MotpeSplitTrialSchema),
    expectedBelow: Schema.Array(Schema.Number),
    expectedAbove: Schema.Array(Schema.Number)
  })
})

export type MotpeSplitFixture = Schema.Schema.Type<typeof MotpeSplitFixtureSchema>

const MotpeReferenceCaseSchema = Schema.Struct({
  id: Schema.String,
  directions: Schema.Array(DirectionSchema),
  worstPoint: ObjectivePointSchema,
  expectedReferencePoint: ObjectivePointSchema
})

export const MotpeReferenceFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("motpe-reference.reference-point"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    epsilon: Schema.Number,
    cases: Schema.Array(MotpeReferenceCaseSchema)
  })
})

export type MotpeReferenceFixture = Schema.Schema.Type<typeof MotpeReferenceFixtureSchema>

const MotpeWeightsFixtureNameSchema = Schema.Literal(
  "motpe-weights.2obj",
  "motpe-weights.mixed-directions",
  "motpe-weights.zero-contribution"
)

export const MotpeWeightsFixtureSchema = Schema.Struct({
  fixture: MotpeWeightsFixtureNameSchema,
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    directions: Schema.Array(DirectionSchema),
    points: Schema.Array(ObjectivePointSchema),
    referencePoint: ObjectivePointSchema,
    expectedContributions: Schema.Array(Schema.Number),
    expectedWeights: Schema.Array(Schema.Number)
  })
})

export type MotpeWeightsFixture = Schema.Schema.Type<typeof MotpeWeightsFixtureSchema>

export const MotpeStudyFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("motpe-study.2obj"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    sampler: TpeReplaySamplerSchema,
    directions: Schema.Array(DirectionSchema),
    expected: Schema.Struct({
      paretoTrialNumbers: Schema.Array(Schema.Number),
      paretoValues: Schema.Array(ObjectivePointSchema),
      configTrace: Schema.Array(ReplayConfigSchema)
    })
  })
})

export type MotpeStudyFixture = Schema.Schema.Type<typeof MotpeStudyFixtureSchema>

const ConstrainedDensityCaseSchema = Schema.Struct({
  id: Schema.String,
  observations: Schema.Array(Schema.Array(Schema.Number)),
  probes: Schema.Array(Schema.Array(Schema.Number)),
  expectedRatioProducts: Schema.Array(Schema.Number),
  expectedOrder: Schema.Array(Schema.Number)
})

const ConstrainedSplitTrialSchema = Schema.Struct({
  trialNumber: Schema.Number,
  value: Schema.Number,
  constraints: Schema.Array(Schema.Number)
})

const ConstrainedSplitCaseSchema = Schema.Struct({
  direction: DirectionSchema,
  nBelow: Schema.Number,
  trials: Schema.Array(ConstrainedSplitTrialSchema),
  expectedBelow: Schema.Array(Schema.Number),
  expectedAbove: Schema.Array(Schema.Number)
})

export const ConstrainedTpeFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("constrained-tpe.parity"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    densityCases: Schema.Array(ConstrainedDensityCaseSchema),
    splitCase: ConstrainedSplitCaseSchema
  })
})

export type ConstrainedTpeFixture = Schema.Schema.Type<typeof ConstrainedTpeFixtureSchema>

const ConditionalFilteringCaseSchema = Schema.Struct({
  id: Schema.String,
  requiredParams: Schema.Array(Schema.String),
  trials: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Number,
      params: PrimitiveConfigSchema
    })
  ),
  expectedIncluded: Schema.Array(Schema.Number),
  expectedExcluded: Schema.Array(Schema.Number)
})

export const ConditionalFilteringFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("conditional.filtering"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(ConditionalFilteringCaseSchema)
  })
})

export type ConditionalFilteringFixture = Schema.Schema.Type<typeof ConditionalFilteringFixtureSchema>

const ConditionalGroupSchema = Schema.Struct({
  key: Schema.String,
  dimensions: Schema.Array(Schema.String)
})

export const ConditionalGroupDecompositionFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("conditional.group-decomposition"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    dimensions: Schema.Array(Schema.String),
    additions: Schema.Array(Schema.Array(Schema.String)),
    expectedGroups: Schema.Array(ConditionalGroupSchema)
  })
})

export type ConditionalGroupDecompositionFixture = Schema.Schema.Type<
  typeof ConditionalGroupDecompositionFixtureSchema
>

const PruningReportCaseSchema = Schema.Struct({
  id: Schema.String,
  initialReports: Schema.Array(IntermediateValueSchema),
  reportAttempt: IntermediateValueSchema,
  expectedReports: Schema.Array(IntermediateValueSchema),
  expectedOutcome: Schema.Literal("accepted", "duplicate-ignored", "error"),
  expectedErrorTag: Schema.optional(Schema.Literal("InvalidReportStep", "InvalidReportValue"))
})

export const PruningReportContractFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("pruning.report-contract"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(PruningReportCaseSchema)
  })
})

export type PruningReportContractFixture = Schema.Schema.Type<typeof PruningReportContractFixtureSchema>

const PercentilePrunerCaseSchema = Schema.Struct({
  id: Schema.String,
  settings: PercentilePrunerSettingsSchema,
  trialNumber: Schema.Number,
  step: Schema.Number,
  currentValue: Schema.Number,
  history: Schema.Array(
    Schema.Struct({
      trialNumber: Schema.Number,
      state: PercentilePrunerTrialStateSchema,
      reports: Schema.Array(IntermediateValueSchema)
    })
  ),
  expectedShouldPrune: Schema.Boolean
})

export const PercentilePrunerFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("pruning.percentile-pruner"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    direction: DirectionSchema,
    cases: Schema.Array(PercentilePrunerCaseSchema)
  })
})

export type PercentilePrunerFixture = Schema.Schema.Type<typeof PercentilePrunerFixtureSchema>

export const FixtureNameSchema = Schema.Literal(
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
  "constrained-tpe.parity"
)

export type FixtureName = Schema.Schema.Type<typeof FixtureNameSchema>

const FixtureManifestGeneratorSchema = Schema.Struct({
  script: Schema.String,
  generatorVersion: Schema.String,
  upstream: Schema.Literal("optuna"),
  upstreamVersion: Schema.String,
  pythonVersion: Schema.String,
  generatedAt: Schema.String
})

export const FixtureManifestEntrySchema = Schema.Struct({
  name: FixtureNameSchema,
  file: Schema.String
})

export const FixtureManifestSchema = Schema.Struct({
  schemaVersion: Schema.Literal("1.0.0"),
  generator: FixtureManifestGeneratorSchema,
  fixtures: Schema.Array(FixtureManifestEntrySchema)
})

export type FixtureManifest = Schema.Schema.Type<typeof FixtureManifestSchema>

export const KnownFixtureSchema = Schema.Union(
  GammaFixtureSchema,
  SplitTrialsFixtureSchema,
  PrunedScoreFixtureSchema,
  MotpeSplitFixtureSchema,
  MotpeReferenceFixtureSchema,
  CategoricalParzenFixtureSchema,
  EiCategoricalFixtureSchema,
  ContinuousKdeFixtureSchema,
  NoiseBandwidthFixtureSchema,
  TruncatedNormalFixtureSchema,
  MultivariateGaussianFixtureSchema,
  MixedSpaceJointTraceFixtureSchema,
  ConditionalFilteringFixtureSchema,
  ConditionalGroupDecompositionFixtureSchema,
  PruningReportContractFixtureSchema,
  PercentilePrunerFixtureSchema,
  TpeCategoricalStudyReplayFixtureSchema,
  MotpeWeightsFixtureSchema,
  MotpeStudyFixtureSchema,
  ConstrainedTpeFixtureSchema
)

export type KnownFixture = Schema.Schema.Type<typeof KnownFixtureSchema>
