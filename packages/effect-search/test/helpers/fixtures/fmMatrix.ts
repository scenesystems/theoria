import { Schema } from "effect"

import { FixtureNameSchema } from "./schemas.js"

export const FmGateSchema = Schema.Literal(
  "FM-1",
  "FM-2",
  "FM-3",
  "FM-4",
  "FM-5",
  "FM-6",
  "FM-7",
  "FM-8",
  "FM-9",
  "FM-10",
  "FM-11",
  "FM-12",
  "FM-13",
  "FM-14",
  "FM-15",
  "FM-16"
)

export const FmGateMatrixEntrySchema = Schema.Struct({
  gate: FmGateSchema,
  namespace: Schema.String,
  fixtures: Schema.Array(FixtureNameSchema),
  consumingTests: Schema.Array(Schema.String)
})

export const FmGateMatrixSchema = Schema.Array(FmGateMatrixEntrySchema)

export type FmGateMatrixEntry = Schema.Schema.Type<typeof FmGateMatrixEntrySchema>

export const fmGateMatrix: Array<FmGateMatrixEntry> = [
  {
    gate: "FM-1",
    namespace: "gamma.",
    fixtures: ["gamma.default-gamma"],
    consumingTests: ["test/Sampler/tpe/gammaSplit.test.ts"]
  },
  {
    gate: "FM-2",
    namespace: "split-trials.",
    fixtures: ["split-trials.single-and-liar"],
    consumingTests: ["test/Sampler/tpe/splitTrials.test.ts"]
  },
  {
    gate: "FM-3",
    namespace: "pruned-score.",
    fixtures: ["pruned-score.pruned-ordering"],
    consumingTests: ["test/Sampler/tpe/prunedScore.test.ts"]
  },
  {
    gate: "FM-4",
    namespace: "motpe-split.",
    fixtures: ["motpe-split.multi-rank-hssp"],
    consumingTests: ["test/Sampler/tpe/multiObjectiveWeights.test.ts"]
  },
  {
    gate: "FM-5",
    namespace: "motpe-reference.",
    fixtures: ["motpe-reference.reference-point"],
    consumingTests: ["test/Sampler/tpe/multiObjectiveWeights.test.ts"]
  },
  {
    gate: "FM-6",
    namespace: "motpe-weights.",
    fixtures: ["motpe-weights.2obj", "motpe-weights.mixed-directions", "motpe-weights.zero-contribution"],
    consumingTests: ["test/Sampler/tpe/multiObjectiveWeights.test.ts"]
  },
  {
    gate: "FM-7",
    namespace: "categorical-parzen.",
    fixtures: ["categorical-parzen.basic", "categorical-parzen.distance", "categorical-parzen.recency-ramp"],
    consumingTests: ["test/Sampler/tpe/fixture-parity.test.ts"]
  },
  {
    gate: "FM-8",
    namespace: "continuous-kde.",
    fixtures: [
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
    ],
    consumingTests: ["test/Sampler/tpe/fixture-parity.test.ts"]
  },
  {
    gate: "FM-8",
    namespace: "truncated-normal.",
    fixtures: ["truncated-normal.edge-cases"],
    consumingTests: ["test/internal/truncatedNormal.test.ts"]
  },
  {
    gate: "FM-15",
    namespace: "noise-bandwidth.",
    fixtures: ["noise-bandwidth.parity"],
    consumingTests: ["test/Sampler/tpe/noise-bandwidth-parity.test.ts"]
  },
  {
    gate: "FM-16",
    namespace: "constrained-tpe.",
    fixtures: ["constrained-tpe.parity"],
    consumingTests: ["test/Sampler/tpe/constrained-parity.test.ts"]
  },
  {
    gate: "FM-9",
    namespace: "ei.",
    fixtures: ["ei.basic", "ei.mixed-trace"],
    consumingTests: ["test/Sampler/tpe/fixture-parity.test.ts", "test/integration/tpe-mixed-study.test.ts"]
  },
  {
    gate: "FM-9",
    namespace: "mixed-space.",
    fixtures: ["mixed-space.joint-trace", "mixed-space.joint-trace.recency-shift"],
    consumingTests: ["test/Sampler/tpe/mixedSpaceParity.test.ts"]
  },
  {
    gate: "FM-10",
    namespace: "conditional.",
    fixtures: ["conditional.filtering"],
    consumingTests: ["test/Sampler/tpe/conditionalParzen.test.ts"]
  },
  {
    gate: "FM-11",
    namespace: "conditional.",
    fixtures: ["conditional.group-decomposition"],
    consumingTests: ["test/Sampler/tpe/conditionalParzen.test.ts"]
  },
  {
    gate: "FM-12",
    namespace: "pruning.",
    fixtures: ["pruning.report-contract"],
    consumingTests: ["test/Study/pruning/fixture-replay.test.ts"]
  },
  {
    gate: "FM-13",
    namespace: "pruning.",
    fixtures: ["pruning.percentile-pruner"],
    consumingTests: [
      "test/Study/pruning/fixture-replay.test.ts",
      "test/integration/optimizer-readiness-contract.test.ts"
    ]
  }
]
