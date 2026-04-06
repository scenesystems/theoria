import { Schema } from "effect"

const FixtureMetadataSchema = Schema.Struct({
  generatedAt: Schema.String,
  upstream: Schema.Struct({
    name: Schema.Literal("dspy"),
    version: Schema.String
  }),
  generator: Schema.Struct({
    script: Schema.String,
    version: Schema.String
  })
})

const MessageRoleSchema = Schema.Literal("system", "user", "assistant")

export const MessageSchema = Schema.Struct({
  role: MessageRoleSchema,
  content: Schema.String
})

const SignatureFieldSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  description: Schema.String
})

const ExampleSchema = Schema.Struct({
  question: Schema.String,
  answer: Schema.String
})

export const ChatPromptFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.qa-basic", "dspy.chat.qa-with-demo"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    signatureDescription: Schema.String,
    inputFields: Schema.Array(SignatureFieldSchema),
    outputFields: Schema.Array(SignatureFieldSchema),
    query: Schema.String,
    demo: Schema.NullOr(ExampleSchema),
    messages: Schema.Array(MessageSchema),
    fieldMarkers: Schema.Array(Schema.String),
    outputRequirements: Schema.String
  })
})

export type ChatPromptFixture = Schema.Schema.Type<typeof ChatPromptFixtureSchema>

export const ChatSystemMessageFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.system-message.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    fieldDescription: Schema.String,
    fieldStructure: Schema.String,
    taskDescription: Schema.String,
    systemMessage: Schema.String,
    requiredMarkers: Schema.Array(Schema.String)
  })
})

export type ChatSystemMessageFixture = Schema.Schema.Type<typeof ChatSystemMessageFixtureSchema>

export const ChatOutputRequirementsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.output-requirements.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    outputRequirements: Schema.String,
    finalUserMessage: Schema.String,
    requiredMarkers: Schema.Array(Schema.String)
  })
})

export type ChatOutputRequirementsFixture = Schema.Schema.Type<typeof ChatOutputRequirementsFixtureSchema>

export const ChatQaOutputRequirementsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.qa-output-requirements"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    signatureDescription: Schema.String,
    inputFields: Schema.Array(SignatureFieldSchema),
    outputFields: Schema.Array(SignatureFieldSchema),
    fieldMarkers: Schema.Array(Schema.String),
    basic: Schema.Struct({
      query: Schema.String,
      messages: Schema.Array(MessageSchema),
      outputRequirements: Schema.String
    }),
    withDemo: Schema.Struct({
      query: Schema.String,
      demo: ExampleSchema,
      messages: Schema.Array(MessageSchema),
      outputRequirements: Schema.String
    })
  })
})

export type ChatQaOutputRequirementsFixture = Schema.Schema.Type<typeof ChatQaOutputRequirementsFixtureSchema>

const ParseSectionSchema = Schema.Struct({
  header: Schema.NullOr(Schema.String),
  content: Schema.String
})

export const ChatParseSectionsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.parse-sections.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    fieldHeaderPattern: Schema.String,
    completion: Schema.String,
    sections: Schema.Array(ParseSectionSchema),
    parsed: Schema.Struct({
      answer: Schema.String
    }),
    expectedOutputFields: Schema.Array(Schema.String)
  })
})

export type ChatParseSectionsFixture = Schema.Schema.Type<typeof ChatParseSectionsFixtureSchema>

const ParseFallbackCaseSchema = Schema.Struct({
  name: Schema.String,
  errorType: Schema.String,
  useJsonAdapterFallback: Schema.Boolean,
  isJsonAdapter: Schema.Boolean,
  fallbackEligible: Schema.Boolean
})

export const ChatParseFallbackFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.chat.parse-fallback.contract"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(ParseFallbackCaseSchema)
  })
})

export type ChatParseFallbackFixture = Schema.Schema.Type<typeof ChatParseFallbackFixtureSchema>

export const ChainOfThoughtReasoningFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.cot.reasoning-field.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    reasoningFieldName: Schema.String,
    outputFieldOrder: Schema.Array(Schema.String),
    reasoningFieldDescription: Schema.String,
    reasoningFieldPrefix: Schema.String,
    sampleInput: Schema.Struct({
      question: Schema.String
    }),
    sampleOutput: Schema.Struct({
      reasoning: Schema.String,
      answer: Schema.String
    }),
    traceLength: Schema.Number,
    traceInputKeys: Schema.Array(Schema.String),
    tracePredictionKeys: Schema.Array(Schema.String)
  })
})

export type ChainOfThoughtReasoningFixture = Schema.Schema.Type<typeof ChainOfThoughtReasoningFixtureSchema>

const ProgramOfThoughtResponseSchema = Schema.Struct({
  reasoning: Schema.String,
  answer: Schema.optional(Schema.String),
  generated_code: Schema.optional(Schema.String)
})

const ProgramOfThoughtTraceEntrySchema = Schema.Struct({
  inputKeys: Schema.Array(Schema.String),
  predictionKeys: Schema.Array(Schema.String)
})

const MultiChainComparisonResponseSchema = Schema.Struct({
  reasoning: Schema.String,
  answer: Schema.String
})

export const ProgramOfThoughtSuccessFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.pot.success.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxIterations: Schema.Number,
    sampleInput: Schema.Struct({
      question: Schema.String
    }),
    responses: Schema.Struct({
      generate: ProgramOfThoughtResponseSchema,
      answer: ProgramOfThoughtResponseSchema
    }),
    codeOutput: Schema.String,
    dspyPredictionKeys: Schema.Array(Schema.String),
    traceEntries: Schema.Array(ProgramOfThoughtTraceEntrySchema)
  })
})

export type ProgramOfThoughtSuccessFixture = Schema.Schema.Type<typeof ProgramOfThoughtSuccessFixtureSchema>

export const ProgramOfThoughtRepairFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.pot.repair-cycle.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxIterations: Schema.Number,
    sampleInput: Schema.Struct({
      question: Schema.String
    }),
    responses: Schema.Struct({
      generate: ProgramOfThoughtResponseSchema,
      repair: ProgramOfThoughtResponseSchema,
      answer: ProgramOfThoughtResponseSchema
    }),
    executionError: Schema.String,
    codeOutput: Schema.String,
    dspyPredictionKeys: Schema.Array(Schema.String),
    traceEntries: Schema.Array(ProgramOfThoughtTraceEntrySchema)
  })
})

export type ProgramOfThoughtRepairFixture = Schema.Schema.Type<typeof ProgramOfThoughtRepairFixtureSchema>

export const ProgramOfThoughtParseErrorFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.pot.parse-error.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxIterations: Schema.Number,
    responses: Schema.Struct({
      generate: ProgramOfThoughtResponseSchema
    }),
    expectedError: Schema.String
  })
})

export type ProgramOfThoughtParseErrorFixture = Schema.Schema.Type<typeof ProgramOfThoughtParseErrorFixtureSchema>

export const MultiChainComparisonFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.multiChainComparison.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    candidateCount: Schema.Number,
    sampleInput: Schema.Struct({
      question: Schema.String
    }),
    candidateResponses: Schema.Array(MultiChainComparisonResponseSchema),
    compareResponse: MultiChainComparisonResponseSchema,
    candidateComparisons: Schema.String,
    reasoningAttempts: Schema.Array(Schema.String),
    dspyPredictionKeys: Schema.Array(Schema.String),
    traceEntries: Schema.Array(ProgramOfThoughtTraceEntrySchema)
  })
})

export type MultiChainComparisonFixture = Schema.Schema.Type<typeof MultiChainComparisonFixtureSchema>

export const TraceEntryShapeFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.trace.entry-shape.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    traceEntryTupleLength: Schema.Number,
    moduleClassName: Schema.String,
    moduleOutputFieldOrder: Schema.Array(Schema.String),
    inputKeys: Schema.Array(Schema.String),
    predictionKeys: Schema.Array(Schema.String),
    sampleInput: Schema.Struct({
      question: Schema.String
    }),
    samplePrediction: Schema.Struct({
      answer: Schema.String
    })
  })
})

export type TraceEntryShapeFixture = Schema.Schema.Type<typeof TraceEntryShapeFixtureSchema>

const TraceScopeRunSchema = Schema.Struct({
  scope: Schema.String,
  question: Schema.String,
  expectedAnswer: Schema.String,
  observedAnswer: Schema.String,
  traceLength: Schema.Number,
  traceInputQuestion: Schema.String,
  tracePredictionKeys: Schema.Array(Schema.String)
})

export const TraceFiberIsolationFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.trace.fiber-isolation.seed-0"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    scopeRuns: Schema.Array(TraceScopeRunSchema),
    crossScopeTraceLeakDetected: Schema.Boolean
  })
})

export type TraceFiberIsolationFixture = Schema.Schema.Type<typeof TraceFiberIsolationFixtureSchema>

const EvaluateExampleSchema = Schema.Struct({
  index: Schema.Number,
  question: Schema.String,
  expectedAnswer: Schema.NullOr(Schema.String),
  predictedAnswer: Schema.NullOr(Schema.String),
  score: Schema.Number,
  failure: Schema.Boolean
})

export const EvaluateReportShapeFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.evaluate.report-shape.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    resultTupleLength: Schema.Literal(3),
    totalExamples: Schema.Number,
    successCount: Schema.Number,
    failureCount: Schema.Number,
    scorePercent: Schema.Number,
    scoreFraction: Schema.Number,
    successfulScoreFraction: Schema.Number,
    examples: Schema.Array(EvaluateExampleSchema)
  })
})

export type EvaluateReportShapeFixture = Schema.Schema.Type<typeof EvaluateReportShapeFixtureSchema>

const EvaluateEventFixtureSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("ExampleStarted"),
    index: Schema.Number,
    total: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ExampleCompleted"),
    index: Schema.Number,
    score: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ExampleFailed"),
    index: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("EvaluationCompleted"),
    overallScore: Schema.Number,
    total: Schema.Number
  })
)

export const EvaluateEventOrderFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.evaluate.event-order.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    eventCount: Schema.Number,
    completedIndices: Schema.Array(Schema.Number),
    failedIndices: Schema.Array(Schema.Number),
    events: Schema.Array(EvaluateEventFixtureSchema)
  })
})

export type EvaluateEventOrderFixture = Schema.Schema.Type<typeof EvaluateEventOrderFixtureSchema>

const MetricRawBooleanCaseSchema = Schema.Struct({
  kind: Schema.Literal("boolean"),
  value: Schema.Boolean
})

const MetricRawNumberCaseSchema = Schema.Struct({
  kind: Schema.Literal("number"),
  value: Schema.Number
})

const MetricRawTupleCaseSchema = Schema.Struct({
  kind: Schema.Literal("tuple"),
  value: Schema.Tuple(Schema.Number, Schema.String)
})

const MetricRawCaseSchema = Schema.Union(
  MetricRawBooleanCaseSchema,
  MetricRawNumberCaseSchema,
  MetricRawTupleCaseSchema
)

const MetricNormalizedCaseSchema = Schema.Struct({
  score: Schema.Number,
  feedback: Schema.NullOr(Schema.String)
})

const MetricScoreFeedbackCaseSchema = Schema.Struct({
  name: Schema.String,
  raw: MetricRawCaseSchema,
  normalized: MetricNormalizedCaseSchema
})

export const MetricScoreFeedbackFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.metric.score-feedback.contract"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    normalizationRules: Schema.Array(Schema.String),
    cases: Schema.Array(MetricScoreFeedbackCaseSchema)
  })
})

export type MetricScoreFeedbackFixture = Schema.Schema.Type<typeof MetricScoreFeedbackFixtureSchema>

const QaPairSchema = Schema.Struct({
  question: Schema.String,
  answer: Schema.String
})

const BootstrapTrainCaseSchema = Schema.Struct({
  question: Schema.String,
  expectedAnswer: Schema.String,
  teacherAnswer: Schema.String
})

export const BootstrapDemoBudgetFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.bootstrap.demo-budget.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxBootstrappedDemos: Schema.Number,
    threshold: Schema.Number,
    maxRounds: Schema.Number,
    trainset: Schema.Array(BootstrapTrainCaseSchema),
    expectedAcceptedQuestions: Schema.Array(Schema.String),
    expectedFinalDemoCount: Schema.Number,
    expectedCallCount: Schema.Number
  })
})

export type BootstrapDemoBudgetFixture = Schema.Schema.Type<typeof BootstrapDemoBudgetFixtureSchema>

export const BootstrapThresholdFilteringFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.bootstrap.threshold-filtering.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxBootstrappedDemos: Schema.Number,
    threshold: Schema.Number,
    maxRounds: Schema.Number,
    trainset: Schema.Array(BootstrapTrainCaseSchema),
    expectedAcceptedQuestions: Schema.Array(Schema.String),
    expectedRejectedQuestions: Schema.Array(Schema.String),
    expectedFinalDemoCount: Schema.Number,
    expectedCallCount: Schema.Number
  })
})

export type BootstrapThresholdFilteringFixture = Schema.Schema.Type<typeof BootstrapThresholdFilteringFixtureSchema>

export const BootstrapThresholdFilteringNoFallbackFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.bootstrap.threshold-filtering.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    maxBootstrappedDemos: Schema.Number,
    threshold: Schema.Number,
    maxRounds: Schema.Number,
    trainset: Schema.Array(BootstrapTrainCaseSchema),
    expectedAcceptedQuestions: Schema.Array(Schema.String),
    expectedRejectedQuestions: Schema.Array(Schema.String),
    expectedFinalDemoCount: Schema.Number,
    expectedCallCount: Schema.Number
  })
})

export type BootstrapThresholdFilteringNoFallbackFixture = Schema.Schema.Type<
  typeof BootstrapThresholdFilteringNoFallbackFixtureSchema
>

export const BootstrapRSCandidateCatalogFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.bootstraprs.candidate-catalog.seed-9"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    numCandidates: Schema.Number,
    seeds: Schema.Array(Schema.Number),
    maxRounds: Schema.Number,
    maxBootstrappedDemos: Schema.Number,
    maxLabeledDemos: Schema.Number,
    threshold: Schema.Number,
    trainset: Schema.Array(QaPairSchema),
    valset: Schema.Array(QaPairSchema),
    expectedCandidateLabels: Schema.Array(Schema.String),
    expectedBestCandidateLabel: Schema.String,
    expectedBestDemoQuestions: Schema.Array(Schema.String),
    expectedCallCount: Schema.Number
  })
})

export type BootstrapRSCandidateCatalogFixture = Schema.Schema.Type<typeof BootstrapRSCandidateCatalogFixtureSchema>

export const LabeledFewShotSampleFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.labeledfewshot.sample-k.seed-9"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    k: Schema.Number,
    trainset: Schema.Array(QaPairSchema),
    expectedSelectedQuestions: Schema.Array(Schema.String),
    expectedCallCount: Schema.Number
  })
})

export type LabeledFewShotSampleFixture = Schema.Schema.Type<typeof LabeledFewShotSampleFixtureSchema>

const EnsembleMajorityVoteCaseSchema = Schema.Struct({
  name: Schema.String,
  question: Schema.String,
  programAnswers: Schema.Array(Schema.String),
  expectedAnswer: Schema.String
})

export const EnsembleMajorityVoteFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.ensemble.majority-vote.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(EnsembleMajorityVoteCaseSchema)
  })
})

export type EnsembleMajorityVoteFixture = Schema.Schema.Type<typeof EnsembleMajorityVoteFixtureSchema>

const MiproTrialBudgetCaseSchema = Schema.Struct({
  name: Schema.String,
  predictorCount: Schema.Number,
  demoCandidateCount: Schema.Number,
  instructionCandidateCount: Schema.Number,
  minimum: Schema.NullOr(Schema.Number),
  expectedBudget: Schema.Number
})

export const MiproPhaseConfigFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.mipro.phase-config"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    phaseOrder: Schema.Array(Schema.String),
    phase1AnchorKinds: Schema.Array(Schema.String),
    phase3TrialBudgetFormula: Schema.String,
    phase3CadenceDefaults: Schema.Struct({
      seed: Schema.Number,
      minibatchSize: Schema.Number,
      fullEvalEvery: Schema.Number
    }),
    phase3Sampler: Schema.Struct({
      kind: Schema.String,
      multivariate: Schema.Boolean
    }),
    phase3PriorTrialCount: Schema.Number
  })
})

export type MiproPhaseConfigFixture = Schema.Schema.Type<typeof MiproPhaseConfigFixtureSchema>

export const MiproTipsVocabularyFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.mipro.tips-vocabulary"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    defaultTips: Schema.Array(Schema.String),
    baselineTip: Schema.String,
    proposalMarkerTemplate: Schema.String,
    diversityTemperatureDefault: Schema.Number
  })
})

export type MiproTipsVocabularyFixture = Schema.Schema.Type<typeof MiproTipsVocabularyFixtureSchema>

export const MiproTrialBudgetCasesFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.mipro.trial-budget-cases"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    formula: Schema.String,
    cases: Schema.Array(MiproTrialBudgetCaseSchema)
  })
})

export type MiproTrialBudgetCasesFixture = Schema.Schema.Type<typeof MiproTrialBudgetCasesFixtureSchema>

const GepaCatalogFixtureEntrySchema = Schema.Struct({
  name: Schema.String,
  file: Schema.String
})

const GepaParentSelectionWeightSchema = Schema.Struct({
  candidateIndex: Schema.Number,
  weight: Schema.Number
})

const GepaParetoHoldingSchema = Schema.Struct({
  exampleIndex: Schema.Number,
  bestScore: Schema.Number,
  holders: Schema.Array(Schema.Number)
})

const GepaSamplingSchema = Schema.Struct({
  seed: Schema.Number,
  draws: Schema.Number,
  tolerance: Schema.Number
})

const GepaScoreMatrixPayloadSchema = Schema.Struct({
  objectiveDirection: Schema.Literal("maximize"),
  scores: Schema.Array(Schema.Array(Schema.Number)),
  expectedFrontierIndices: Schema.Array(Schema.Number),
  expectedDominatedIndices: Schema.Array(Schema.Number),
  expectedHoldings: Schema.Array(GepaParetoHoldingSchema),
  expectedSelectionWeights: Schema.Array(GepaParentSelectionWeightSchema),
  sampling: GepaSamplingSchema
})

export const GepaParetoScoreMatrixFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.pareto.score-matrix.basic", "dspy.gepa.pareto.score-matrix.ties"),
  metadata: FixtureMetadataSchema,
  payload: GepaScoreMatrixPayloadSchema
})

export type GepaParetoScoreMatrixFixture = Schema.Schema.Type<typeof GepaParetoScoreMatrixFixtureSchema>

const GepaExpectedProbabilitySchema = Schema.Struct({
  candidateIndex: Schema.Number,
  probability: Schema.Number
})

export const GepaSelectionWeightsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.selection.weights.seed-42"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    draws: Schema.Number,
    tolerance: Schema.Number,
    weights: Schema.Array(GepaParentSelectionWeightSchema),
    expectedProbabilities: Schema.Array(GepaExpectedProbabilitySchema)
  })
})

export type GepaSelectionWeightsFixture = Schema.Schema.Type<typeof GepaSelectionWeightsFixtureSchema>

const GepaReflectSampleSchema = Schema.Struct({
  exampleId: Schema.String,
  predictorName: Schema.String,
  inputs: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  generatedOutputs: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  expectedOutput: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  metricResult: Schema.Struct({
    score: Schema.Number,
    feedback: Schema.optional(Schema.String)
  })
})

export const GepaReflectDatasetShapeFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.reflect.dataset-shape"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    predictorName: Schema.String,
    currentInstruction: Schema.String,
    samples: Schema.Array(GepaReflectSampleSchema),
    expectedPromptSections: Schema.Array(Schema.String)
  })
})

export type GepaReflectDatasetShapeFixture = Schema.Schema.Type<typeof GepaReflectDatasetShapeFixtureSchema>

export const GepaReflectPromptTemplateFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.reflect.prompt-template.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    predictorName: Schema.String,
    currentInstruction: Schema.String,
    requiredSubstrings: Schema.Array(Schema.String),
    expectedSectionOrder: Schema.Array(Schema.String)
  })
})

export type GepaReflectPromptTemplateFixture = Schema.Schema.Type<typeof GepaReflectPromptTemplateFixtureSchema>

export const GepaReflectFormatFailureFeedbackFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.reflect.format-failure-feedback"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    structureInstruction: Schema.String,
    expectedPrefix: Schema.String,
    expectedFeedback: Schema.String
  })
})

export type GepaReflectFormatFailureFeedbackFixture = Schema.Schema.Type<
  typeof GepaReflectFormatFailureFeedbackFixtureSchema
>

const GepaMutationAcceptanceCaseSchema = Schema.Struct({
  name: Schema.String,
  previousSubsampleScores: Schema.Array(Schema.Number),
  mutatedSubsampleScores: Schema.Array(Schema.Number),
  fullValsetScores: Schema.Array(Schema.Number),
  expectedGate1Passed: Schema.Boolean,
  expectedFullValsetEvaluated: Schema.Boolean,
  expectedAccepted: Schema.Boolean
})

export const GepaAcceptMutationStrictGreaterFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.accept.mutation-strict-greater"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(GepaMutationAcceptanceCaseSchema)
  })
})

export type GepaAcceptMutationStrictGreaterFixture = Schema.Schema.Type<
  typeof GepaAcceptMutationStrictGreaterFixtureSchema
>

const GepaMergeAcceptanceCaseSchema = Schema.Struct({
  name: Schema.String,
  mergedSubsampleScores: Schema.Array(Schema.Number),
  parentASubsampleScores: Schema.Array(Schema.Number),
  parentBSubsampleScores: Schema.Array(Schema.Number),
  expectedAccepted: Schema.Boolean
})

export const GepaAcceptMergeNonStrictFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.accept.merge-non-strict"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    cases: Schema.Array(GepaMergeAcceptanceCaseSchema)
  })
})

export type GepaAcceptMergeNonStrictFixture = Schema.Schema.Type<typeof GepaAcceptMergeNonStrictFixtureSchema>

const GepaPredictorInstructionSchema = Schema.Struct({
  predictorName: Schema.String,
  instruction: Schema.String
})

const GepaMergeCandidateSchema = Schema.Struct({
  candidateId: Schema.String,
  parentIds: Schema.Array(Schema.String),
  predictorInstructions: Schema.Array(GepaPredictorInstructionSchema)
})

const GepaMergeComparisonSchema = Schema.Struct({
  exampleId: Schema.String,
  parentAScore: Schema.Number,
  parentBScore: Schema.Number
})

export const GepaMergeCommonAncestorCasesFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.merge.common-ancestor-cases"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    parentAId: Schema.String,
    parentBId: Schema.String,
    expectedCommonAncestorId: Schema.String,
    expectedBalancedSubsampleIds: Schema.Array(Schema.String),
    candidates: Schema.Array(GepaMergeCandidateSchema),
    comparisons: Schema.Array(GepaMergeComparisonSchema)
  })
})

export type GepaMergeCommonAncestorCasesFixture = Schema.Schema.Type<typeof GepaMergeCommonAncestorCasesFixtureSchema>

const GepaMergeAttemptDecisionSchema = Schema.Struct({
  name: Schema.String,
  lastIterationFoundNew: Schema.Boolean,
  candidateCount: Schema.Number,
  mergeBudgetRemaining: Schema.Number,
  expectedShouldAttempt: Schema.Boolean
})

const GepaMergeBudgetTransitionSchema = Schema.Struct({
  before: Schema.Number,
  after: Schema.Number
})

export const GepaMergeScheduleFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.merge.schedule.max-merge-invocations"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    defaultMaxMergeInvocations: Schema.Number,
    attemptDecisions: Schema.Array(GepaMergeAttemptDecisionSchema),
    acceptedMergeBudgetTransitions: Schema.Array(GepaMergeBudgetTransitionSchema)
  })
})

export type GepaMergeScheduleFixture = Schema.Schema.Type<typeof GepaMergeScheduleFixtureSchema>

const GepaEventTimelineItemSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("IterationStarted"),
    iteration: Schema.Number,
    frontierSize: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("MergeChecked"),
    iteration: Schema.Number,
    attempted: Schema.Boolean,
    accepted: Schema.Boolean,
    mergeBudgetRemaining: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("MutationProposed"),
    iteration: Schema.Number,
    parentId: Schema.String,
    mutatedCandidateId: Schema.String,
    predictorName: Schema.String,
    instruction: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("AcceptanceEvaluated"),
    iteration: Schema.Number,
    accepted: Schema.Boolean,
    gate1Passed: Schema.Boolean,
    fullValsetEvaluated: Schema.Boolean,
    previousSubsampleSum: Schema.Number,
    mutatedSubsampleSum: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ParetoUpdated"),
    iteration: Schema.Number,
    frontierIndices: Schema.Array(Schema.Number),
    dominatedIndices: Schema.Array(Schema.Number),
    parentWeights: Schema.Array(GepaParentSelectionWeightSchema)
  }),
  Schema.Struct({
    _tag: Schema.Literal("IterationCompleted"),
    iteration: Schema.Number,
    acceptedCandidate: Schema.Boolean,
    frontierSize: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("OptimizationCompleted"),
    iterations: Schema.Number,
    bestCandidateId: Schema.String,
    frontierSize: Schema.Number
  })
)

export const GepaOrchestrationEventOrderFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.orchestration.event-order.seed-0"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    maxIterations: Schema.Number,
    timeline: Schema.Array(GepaEventTimelineItemSchema),
    expectedWithinIterationOrder: Schema.Array(Schema.String),
    expectedTerminalTag: Schema.String
  })
})

export type GepaOrchestrationEventOrderFixture = Schema.Schema.Type<typeof GepaOrchestrationEventOrderFixtureSchema>

const GepaStateTransitionSchema = Schema.Struct({
  name: Schema.String,
  iteration: Schema.Number,
  candidateCount: Schema.Number,
  mergeBudgetRemaining: Schema.Number,
  lastIterationFoundNew: Schema.Boolean,
  expectedShouldAttemptMerge: Schema.Boolean
})

export const GepaOrchestrationStateTransitionsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.orchestration.state-transitions.basic"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    transitions: Schema.Array(GepaStateTransitionSchema),
    expectedCandidateCountProgression: Schema.Array(Schema.Number),
    expectedLastIterationFoundNew: Schema.Array(Schema.Boolean)
  })
})

export type GepaOrchestrationStateTransitionsFixture = Schema.Schema.Type<
  typeof GepaOrchestrationStateTransitionsFixtureSchema
>

const GepaFrontierSnapshotSchema = Schema.Struct({
  iteration: Schema.Number,
  frontierIndices: Schema.Array(Schema.Number),
  dominatedIndices: Schema.Array(Schema.Number),
  parentWeights: Schema.Array(GepaParentSelectionWeightSchema)
})

export const GepaReplayFrontierSnapshotsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.replay.frontier-snapshots.seed-0"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    snapshots: Schema.Array(GepaFrontierSnapshotSchema),
    byteStableFields: Schema.Array(Schema.String)
  })
})

export type GepaReplayFrontierSnapshotsFixture = Schema.Schema.Type<typeof GepaReplayFrontierSnapshotsFixtureSchema>

export const GepaReplayParamsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.replay.params.seed-0"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    moduleName: Schema.String,
    savedState: Schema.Unknown,
    stableJsonKeys: Schema.Array(Schema.String),
    expectedInstructionContains: Schema.Array(Schema.String)
  })
})

export type GepaReplayParamsFixture = Schema.Schema.Type<typeof GepaReplayParamsFixtureSchema>

export const GepaGovernancePublicSeamsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.governance.public-seams"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    allowedEffectSearchImports: Schema.Array(Schema.String),
    forbiddenEffectSearchImportPrefixes: Schema.Array(Schema.String),
    allowedRuntimeImportOwners: Schema.Array(Schema.String),
    expectedOptimizerIndexExports: Schema.Array(Schema.String),
    expectedOptimizerEventsExports: Schema.Array(Schema.String)
  })
})

export type GepaGovernancePublicSeamsFixture = Schema.Schema.Type<typeof GepaGovernancePublicSeamsFixtureSchema>

export const GepaGovernanceOptimizerOptionsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.governance.optimizer-options"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    requiredOptionKeys: Schema.Array(Schema.String),
    optionalOptionKeys: Schema.Array(Schema.String),
    defaultMaxMergeInvocations: Schema.Number,
    eventTags: Schema.Array(Schema.String)
  })
})

export type GepaGovernanceOptimizerOptionsFixture = Schema.Schema.Type<
  typeof GepaGovernanceOptimizerOptionsFixtureSchema
>

export const GepaCatalogVersionedFixturesFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.catalog.versioned-fixtures"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    fixtureSet: Schema.String,
    version: Schema.Number,
    fixtures: Schema.Array(GepaCatalogFixtureEntrySchema),
    namespaces: Schema.Array(Schema.String),
    requiredFixtureCount: Schema.Number
  })
})

export type GepaCatalogVersionedFixturesFixture = Schema.Schema.Type<typeof GepaCatalogVersionedFixturesFixtureSchema>

export const GepaReplaySeedContractFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("dspy.gepa.replay.seed-0.contract"),
  metadata: FixtureMetadataSchema,
  payload: Schema.Struct({
    seed: Schema.Number,
    moduleName: Schema.String,
    maxIterations: Schema.Number,
    trainsetSize: Schema.Number,
    requiredManifestFixtures: Schema.Array(Schema.String),
    byteEqualityChecks: Schema.Array(Schema.String)
  })
})

export type GepaReplaySeedContractFixture = Schema.Schema.Type<typeof GepaReplaySeedContractFixtureSchema>

export const FixtureNameSchema = Schema.Literal(
  "dspy.chat.qa-basic",
  "dspy.chat.qa-with-demo",
  "dspy.chat.system-message.basic",
  "dspy.chat.output-requirements.basic",
  "dspy.chat.qa-output-requirements",
  "dspy.chat.parse-sections.basic",
  "dspy.chat.parse-fallback.contract",
  "dspy.cot.reasoning-field.basic",
  "dspy.pot.success.basic",
  "dspy.pot.repair-cycle.basic",
  "dspy.pot.parse-error.basic",
  "dspy.multiChainComparison.basic",
  "dspy.trace.entry-shape.basic",
  "dspy.trace.fiber-isolation.seed-0",
  "dspy.evaluate.report-shape.basic",
  "dspy.evaluate.event-order.basic",
  "dspy.metric.score-feedback.contract",
  "dspy.bootstrap.demo-budget.basic",
  "dspy.bootstrap.threshold-filtering.basic",
  "dspy.bootstraprs.candidate-catalog.seed-9",
  "dspy.labeledfewshot.sample-k.seed-9",
  "dspy.ensemble.majority-vote.basic",
  "dspy.mipro.phase-config",
  "dspy.mipro.tips-vocabulary",
  "dspy.mipro.trial-budget-cases",
  "dspy.gepa.pareto.score-matrix.basic",
  "dspy.gepa.pareto.score-matrix.ties",
  "dspy.gepa.selection.weights.seed-42",
  "dspy.gepa.reflect.dataset-shape",
  "dspy.gepa.reflect.prompt-template.basic",
  "dspy.gepa.reflect.format-failure-feedback",
  "dspy.gepa.accept.mutation-strict-greater",
  "dspy.gepa.accept.merge-non-strict",
  "dspy.gepa.merge.common-ancestor-cases",
  "dspy.gepa.merge.schedule.max-merge-invocations",
  "dspy.gepa.orchestration.event-order.seed-0",
  "dspy.gepa.orchestration.state-transitions.basic",
  "dspy.gepa.replay.frontier-snapshots.seed-0",
  "dspy.gepa.replay.params.seed-0",
  "dspy.gepa.governance.public-seams",
  "dspy.gepa.governance.optimizer-options",
  "dspy.gepa.catalog.versioned-fixtures",
  "dspy.gepa.replay.seed-0.contract"
)

export type FixtureName = Schema.Schema.Type<typeof FixtureNameSchema>

const FixtureManifestGeneratorSchema = Schema.Struct({
  script: Schema.String,
  generatorVersion: Schema.String,
  upstream: Schema.Literal("dspy"),
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
  ChatPromptFixtureSchema,
  ChatSystemMessageFixtureSchema,
  ChatOutputRequirementsFixtureSchema,
  ChatQaOutputRequirementsFixtureSchema,
  ChatParseSectionsFixtureSchema,
  ChatParseFallbackFixtureSchema,
  ChainOfThoughtReasoningFixtureSchema,
  ProgramOfThoughtSuccessFixtureSchema,
  ProgramOfThoughtRepairFixtureSchema,
  ProgramOfThoughtParseErrorFixtureSchema,
  MultiChainComparisonFixtureSchema,
  TraceEntryShapeFixtureSchema,
  TraceFiberIsolationFixtureSchema,
  EvaluateReportShapeFixtureSchema,
  EvaluateEventOrderFixtureSchema,
  MetricScoreFeedbackFixtureSchema,
  BootstrapDemoBudgetFixtureSchema,
  BootstrapThresholdFilteringFixtureSchema,
  BootstrapRSCandidateCatalogFixtureSchema,
  LabeledFewShotSampleFixtureSchema,
  EnsembleMajorityVoteFixtureSchema,
  MiproPhaseConfigFixtureSchema,
  MiproTipsVocabularyFixtureSchema,
  MiproTrialBudgetCasesFixtureSchema,
  GepaParetoScoreMatrixFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  GepaReflectDatasetShapeFixtureSchema,
  GepaReflectPromptTemplateFixtureSchema,
  GepaReflectFormatFailureFeedbackFixtureSchema,
  GepaAcceptMutationStrictGreaterFixtureSchema,
  GepaAcceptMergeNonStrictFixtureSchema,
  GepaMergeCommonAncestorCasesFixtureSchema,
  GepaMergeScheduleFixtureSchema,
  GepaOrchestrationEventOrderFixtureSchema,
  GepaOrchestrationStateTransitionsFixtureSchema,
  GepaReplayFrontierSnapshotsFixtureSchema,
  GepaReplayParamsFixtureSchema,
  GepaGovernancePublicSeamsFixtureSchema,
  GepaGovernanceOptimizerOptionsFixtureSchema,
  GepaCatalogVersionedFixturesFixtureSchema,
  GepaReplaySeedContractFixtureSchema
)

export type KnownFixture = Schema.Schema.Type<typeof KnownFixtureSchema>
