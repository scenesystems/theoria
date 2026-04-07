import { Chunk, Effect, Either, Fiber, Match, Option, Ref, Schema, Stream } from "effect"
import {
  type GraphExecutionManifest,
  type GraphExecutionProjection,
  type NodeExecutionContract,
  type WorkflowExecutionRecord,
  type WorkflowStateLane
} from "effect-inference/Contracts"
import { Sampler, SearchSpace, Study } from "effect-search"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import type { StudyEvent } from "effect-search/StudyEvent"
import * as Arr from "effect/Array"
import * as Record from "effect/Record"

import {
  canonicalStepEvent,
  Choreography,
  type EvidenceEvent,
  SectionAppend,
  SectionUpsert,
  StageAdvance,
  StageEnter,
  StageExit
} from "../../contracts/evidence-stream.js"
import type { EvidenceItem, EvidenceSection } from "../../contracts/evidence.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys
} from "../../contracts/workflow/comparison-evidence-keys.js"
import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonRunPlan,
  WorkflowComparisonVariantExecution as WorkflowComparisonVariantExecutionSchema
} from "../../contracts/workflow/comparison-run.js"
import { WorkflowComparisonCanonicalStep } from "../../contracts/workflow/comparison-step.js"
import type { DspProviderRuntime } from "../demos/effect-dsp/provider.js"
import { makeWorkflowExecutionRecord } from "./decode.js"
import { evaluateVariantExecutionEffect } from "./evaluation.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { workflowComparisonChoicesForPlan, workflowComparisonSelectedKnobsForRecord } from "./run-controls.js"
import {
  advanceExecutionState,
  finalizeVariantExecution,
  initialExecutionState,
  nodeExecutionForVariant,
  prepareVariantPlanForRecord,
  type WorkflowComparisonSelectedKnobs,
  WorkflowComparisonSelectedKnobsSchema
} from "./runtime.js"

// Decomposition plan: this module still owns search-space projection, ask/tell execution,
// and evidence projection so the workflow-comparison optimization lane can converge on one
// server authority. Split along those three seams once the published knob family stabilizes.

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))
const encodeStudySnapshotJson = Schema.encodeSync(Schema.parseJson(Study.StudySnapshot))
const decodeSelectedKnobsEither = Schema.decodeUnknownEither(WorkflowComparisonSelectedKnobsSchema)

const WorkflowComparisonSearchEvaluationSchema = Schema.Struct({
  selection: WorkflowComparisonSelectedKnobsSchema,
  selectionKey: Schema.String,
  execution: WorkflowComparisonVariantExecutionSchema
})

export type WorkflowComparisonSearchEvaluation = Schema.Schema.Type<typeof WorkflowComparisonSearchEvaluationSchema>

export const WorkflowComparisonSearchStudyOutcomeSchema = Schema.Struct({
  trialBudget: NonNegativeInt,
  events: Schema.Array(SearchStudyEvent.StudyEventSchema),
  snapshot: Study.StudySnapshot,
  authored: WorkflowComparisonSearchEvaluationSchema,
  winner: WorkflowComparisonSearchEvaluationSchema
})

export type WorkflowComparisonSearchStudyOutcome = Schema.Schema.Type<typeof WorkflowComparisonSearchStudyOutcomeSchema>

type WorkflowComparisonSearchProgressPublisher<R> = (
  events: ReadonlyArray<EvidenceEvent>
) => Effect.Effect<void, never, R>

type WorkflowComparisonSearchDimension = {
  readonly key: string
  readonly choices: ReadonlyArray<string>
}

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const searchSeedForComparison = (comparison: FrozenWorkflowComparisonRun): number =>
  Match.value(comparison.comparisonId).pipe(
    Match.when("workflow-comparison/task-briefing", () => 410),
    Match.when("workflow-comparison/chat-handoff", () => 411),
    Match.when("workflow-comparison/retrieval-required", () => 412),
    Match.when("workflow-comparison/render-sensitive", () => 413),
    Match.exhaustive
  )

const categoricalDimension = (choices: ReadonlyArray<string>) =>
  Arr.matchLeft(choices, {
    onEmpty: () => SearchSpace.categorical(["unreachable-empty-choice"]),
    onNonEmpty: (head, tail) => SearchSpace.categorical([head, ...tail])
  })

const searchDimensionsForComparison = (
  comparison: FrozenWorkflowComparisonRun,
  plan: WorkflowComparisonRunPlan
): Effect.Effect<ReadonlyArray<WorkflowComparisonSearchDimension>, WorkflowComparisonExecutionError, never> => {
  const dimensions = comparison.optimized.record.graph.optimizationKnobs.map((knob) => ({
    key: knob.key,
    choices: workflowComparisonChoicesForPlan({
      choices: knob.choices,
      key: knob.key,
      plan
    })
  }))

  return Arr.some(dimensions, (dimension) => dimension.choices.length === 0)
    ? Effect.fail(
      executionError(`Workflow comparison ${comparison.comparisonId} declared an empty optimization knob choice set.`)
    )
    : Effect.succeed(dimensions)
}

const searchSpaceForDimensions = (dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>) =>
  SearchSpace.unsafeMake(
    dimensions.reduce<Readonly<Record<string, Schema.Schema.AnyNoContext>>>(
      (definition, dimension) => ({
        ...definition,
        [dimension.key]: categoricalDimension(dimension.choices)
      }),
      {}
    )
  )

const authoredOptimizedSelection = (
  comparison: FrozenWorkflowComparisonRun,
  plan: WorkflowComparisonRunPlan
): WorkflowComparisonSelectedKnobs =>
  workflowComparisonSelectedKnobsForRecord({
    plan,
    record: comparison.optimized.record
  })

const selectionValue = ({
  fallback,
  key,
  selection
}: {
  readonly fallback: string
  readonly key: string
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  Option.fromNullable(selection[key]).pipe(
    Option.getOrElse(() => fallback)
  )

const selectionKey = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}:${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join("|")

const manifestSuffix = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): string => selectionKey({ dimensions, selection }).replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "")

const optimizationKnobByKey = (
  manifest: GraphExecutionManifest
): Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>> =>
  manifest.optimizationKnobs.reduce<Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>>>(
    (lookup, knob) => ({
      ...lookup,
      [knob.key]: knob
    }),
    {}
  )

const nodeIsEnabled = ({
  knobLookup,
  node,
  selection
}: {
  readonly knobLookup: Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>>
  readonly node: NodeExecutionContract
  readonly selection: WorkflowComparisonSelectedKnobs
}): boolean =>
  node.optimizationKnobRefs.reduce(
    (enabled, knobKey) =>
      enabled
      && Option.fromNullable(knobLookup[knobKey]).pipe(
        Option.match({
          onNone: () => true,
          onSome: (knob) =>
            knob.kind !== "node-enabled"
            || selectionValue({ fallback: "enabled", key: knob.key, selection }) !== "disabled"
        })
      ),
    true
  )

const nodeIds = (nodes: ReadonlyArray<NodeExecutionContract>): ReadonlyArray<string> => nodes.map((node) => node.nodeId)

const activeStateLanesForRecord = (record: WorkflowExecutionRecord): ReadonlyArray<WorkflowStateLane> =>
  record.projection.activeStateLanes.filter((lane, index, lanes) => lanes.indexOf(lane) === index)

const projectionForRecord = ({
  edges,
  manifestId,
  nodes,
  record
}: {
  readonly edges: WorkflowExecutionRecord["graph"]["edges"]
  readonly manifestId: string
  readonly nodes: ReadonlyArray<NodeExecutionContract>
  readonly record: WorkflowExecutionRecord
}): GraphExecutionProjection => {
  const remainingNodeIds = nodeIds(nodes)
  const terminalNodeIds = nodes
    .filter((node) => !edges.some((edge) => edge.fromNodeId === node.nodeId))
    .map((node) => node.nodeId)

  return {
    manifestId,
    entryNodeId: record.projection.entryNodeId,
    terminalNodeIds,
    activeStateLanes: activeStateLanesForRecord({
      ...record,
      graph: { ...record.graph, manifestId, nodes, edges }
    }).filter((lane) =>
      record.session.stateLanes.some((stateLane) => stateLane.lane === lane)
      || nodes.some((node) => node.inputLanes.includes(lane) || node.outputLane === lane)
      || remainingNodeIds.includes(record.projection.entryNodeId)
    )
  }
}

const recordForSelection = ({
  comparison,
  dimensions,
  selection
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): WorkflowExecutionRecord => {
  const optimizedRecord = comparison.optimized.record
  const knobLookup = optimizationKnobByKey(optimizedRecord.graph)
  const nodes = optimizedRecord.graph.nodes.filter((node) => nodeIsEnabled({ knobLookup, node, selection }))
  const remainingNodeIds = nodeIds(nodes)
  const edges = optimizedRecord.graph.edges.filter(
    (edge) => remainingNodeIds.includes(edge.fromNodeId) && remainingNodeIds.includes(edge.toNodeId)
  )
  const manifestId = `${optimizedRecord.graph.manifestId}-${manifestSuffix({ dimensions, selection })}`

  return makeWorkflowExecutionRecord({
    ...optimizedRecord,
    recordId: `${optimizedRecord.recordId}-${manifestSuffix({ dimensions, selection })}`,
    graph: {
      ...optimizedRecord.graph,
      manifestId,
      nodes,
      edges
    },
    projection: projectionForRecord({
      edges,
      manifestId,
      nodes,
      record: optimizedRecord
    })
  })
}

const evaluateSelection = ({
  comparison,
  dimensions,
  lane,
  selection
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly lane: WorkflowComparisonExecutionLane
  readonly selection: WorkflowComparisonSelectedKnobs
}): Effect.Effect<WorkflowComparisonSearchEvaluation, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  Effect.gen(function*() {
    const record = recordForSelection({ comparison, dimensions, selection })
    const plan = yield* prepareVariantPlanForRecord({
      variant: "optimized",
      record,
      profile: comparison.optimized.profile,
      selectedKnobs: selection
    })
    const stateRef = yield* Ref.make(initialExecutionState(plan.record))
    const indexedTraversal = plan.graphProjection.traversal.map((nodeId, index) => ({
      nodeId,
      stepIndex: index + 1,
      stepCount: plan.graphProjection.traversal.length
    }))
    const nodeExecutions = yield* Effect.forEach(
      indexedTraversal,
      ({ nodeId, stepCount, stepIndex }) =>
        Ref.get(stateRef).pipe(
          Effect.flatMap((state) =>
            nodeExecutionForVariant({
              comparison,
              lane,
              plan,
              state,
              nodeId,
              stepCount,
              stepIndex
            }).pipe(
              Effect.tap((nodeExecution) =>
                Ref.set(
                  stateRef,
                  advanceExecutionState({
                    state,
                    node: nodeExecution.node,
                    outputText: nodeExecution.outputText
                  })
                )
              )
            )
          )
        )
    )
    const report = yield* evaluateVariantExecutionEffect({
      comparison,
      nodeExecutions,
      plan
    })
    const execution = yield* finalizeVariantExecution({
      nodeExecutions,
      plan,
      report
    })

    return {
      selection,
      selectionKey: selectionKey({ dimensions, selection }),
      execution
    }
  })

const selectionFromConfig = (
  config: unknown
): Effect.Effect<WorkflowComparisonSelectedKnobs, WorkflowComparisonExecutionError, never> =>
  Either.match(decodeSelectedKnobsEither(config), {
    onLeft: () =>
      Effect.fail(
        executionError("Workflow comparison study produced an invalid knob-selection config.")
      ),
    onRight: Effect.succeed
  })

const formatSelectionFromConfig = ({
  config,
  dimensions
}: {
  readonly config: unknown
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
}): string =>
  Either.match(decodeSelectedKnobsEither(config), {
    onLeft: () => encodeUnknownJson(config),
    onRight: (selection) => formatSelection({ dimensions, selection })
  })

const singleObjectiveBestSelectionKey = <Config>({
  dimensions,
  outcome
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: Study.StudyResult<Config>
}): Effect.Effect<string, WorkflowComparisonExecutionError, never> =>
  outcome._tag === "SingleObjective"
    ? selectionFromConfig(outcome.bestTrial.config).pipe(
      Effect.map((selection) => selectionKey({ dimensions, selection }))
    )
    : Effect.fail(
      executionError("Workflow comparison search opened a multi-objective study for a single-score optimization lane.")
    )

const formatSelection = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}=${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join(" · ")

const formatObjectiveValue = (value: number | ReadonlyArray<number>): string =>
  typeof value === "number"
    ? value.toFixed(6)
    : Arr.isNonEmptyReadonlyArray(value)
    ? value.map((entry) => entry.toFixed(6)).join(", ")
    : "n/a"

const formatEventDetail = ({
  dimensions,
  event
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly event: StudyEvent
}): string =>
  SearchStudyEvent.matchStudyEvent<string>({
    TrialStarted: ({ config, trialNumber }) =>
      `trial ${trialNumber} reserved · ${formatSelectionFromConfig({ config, dimensions })}`,
    TrialCompleted: ({ trialNumber, value }) => `trial ${trialNumber} completed · score ${formatObjectiveValue(value)}`,
    BestUpdated: ({ trialNumber, value }) =>
      `best updated by trial ${trialNumber} · score ${formatObjectiveValue(value)}`,
    TrialReported: ({ decision, step, trialNumber, value }) =>
      `trial ${trialNumber} reported ${formatObjectiveValue(value)} at step ${step} · ${decision._tag}`,
    TrialPruned: ({ trialNumber, reason }) => `trial ${trialNumber} pruned · ${reason}`,
    TrialRetried: ({ attempt, trialNumber }) => `trial ${trialNumber} retried · attempt ${attempt}`,
    TrialCancelled: ({ reason, trialNumber }) => `trial ${trialNumber} cancelled · ${reason}`,
    TrialFailed: ({ error, trialNumber }) => `trial ${trialNumber} failed · ${error.message}`,
    TrialCosted: ({ cost, cumulativeCost, trialNumber }) =>
      `trial ${trialNumber} cost ${cost.toFixed(3)} · cumulative ${cumulativeCost.toFixed(3)}`,
    StudyStopRequested: ({ mode, reason }) => `stop requested · ${mode} · ${reason}`,
    BracketStarted: ({ bracketIndex, configs, minResource }) =>
      `bracket ${bracketIndex} started · ${configs} configs · min resource ${minResource}`,
    RoundStarted: ({ bracketIndex, nConfigs, resource, roundIndex }) =>
      `round ${bracketIndex}.${roundIndex} started · ${nConfigs} configs · resource ${resource}`,
    RoundCompleted: ({ bracketIndex, completed, nConfigs, roundIndex }) =>
      `round ${bracketIndex}.${roundIndex} completed · ${completed}/${nConfigs}`,
    BracketCompleted: ({ bestValue, bracketIndex, rounds }) =>
      Option.fromNullable(bestValue).pipe(
        Option.match({
          onNone: () => `bracket ${bracketIndex} completed · ${rounds} rounds`,
          onSome: (value) =>
            `bracket ${bracketIndex} completed · best ${formatObjectiveValue(value)} · ${rounds} rounds`
        })
      ),
    StudyCompleted: ({ completionReason }) => `study completed · ${completionReason}`
  })(event)

const selectionRows = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): ReadonlyArray<ReadonlyArray<string>> =>
  dimensions.map((dimension) => [
    dimension.key,
    selectionValue({ fallback: "unset", key: dimension.key, selection })
  ])

const aggregateScoreForEvaluation = (evaluation: WorkflowComparisonSearchEvaluation): number =>
  evaluation.execution.report.aggregateScore

const bestEvaluation = (
  evaluations: Readonly<Record<string, WorkflowComparisonSearchEvaluation>>
): Option.Option<WorkflowComparisonSearchEvaluation> =>
  Record.values(evaluations).reduce<Option.Option<WorkflowComparisonSearchEvaluation>>(
    (best, evaluation) =>
      Option.match(best, {
        onNone: () => Option.some(evaluation),
        onSome: (currentBest) =>
          Option.some(
            aggregateScoreForEvaluation(evaluation) > aggregateScoreForEvaluation(currentBest)
              ? evaluation
              : currentBest
          )
      }),
    Option.none()
  )

const itemText = (label: string, value: string, key?: string): EvidenceItem => ({
  _tag: "Text",
  key,
  label,
  value
})

const optimizationStudyProgressSection = ({
  best,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowComparisonSearchEvaluation
  readonly completedTrials: number
  readonly current: WorkflowComparisonSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly trialBudget: number
}): EvidenceSection => ({
  key: workflowComparisonEvidenceSectionKeys.optimizationStudyProgress,
  title: "Optimization Study Progress",
  items: [
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.completedTrials,
      label: "Completed trials",
      value: completedTrials,
      unit: "trials",
      format: "integer"
    },
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.trialBudget,
      label: "Trial budget",
      value: trialBudget,
      unit: "trials",
      format: "integer"
    },
    itemText(
      "Current selection",
      formatSelection({ dimensions, selection: current.selection }),
      workflowComparisonEvidenceItemKeys.currentSelection
    ),
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.currentScore,
      label: "Current score",
      value: aggregateScoreForEvaluation(current),
      unit: "score",
      format: "fixed"
    },
    itemText(
      "Best selection",
      formatSelection({ dimensions, selection: best.selection }),
      workflowComparisonEvidenceItemKeys.bestSelection
    ),
    {
      _tag: "Scalar",
      key: workflowComparisonEvidenceItemKeys.bestScore,
      label: "Best score",
      value: aggregateScoreForEvaluation(best),
      unit: "score",
      format: "fixed"
    }
  ]
})

export const optimizationStudyStartedEvents = ({
  trialBudget
}: {
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({
    cue: new StageEnter({ stageId: "optimization-study", params: { trialBudget, stepCount: trialBudget } })
  })
]

const optimizationStudyProgressEvents = ({
  best,
  comparison,
  completedTrials,
  current,
  dimensions,
  trialBudget
}: {
  readonly best: WorkflowComparisonSearchEvaluation
  readonly comparison: FrozenWorkflowComparisonRun
  readonly completedTrials: number
  readonly current: WorkflowComparisonSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly trialBudget: number
}): ReadonlyArray<EvidenceEvent> => [
  new Choreography({
    cue: new StageAdvance({ stageId: "optimization-study", step: completedTrials - 1 })
  }),
  canonicalStepEvent(
    new WorkflowComparisonCanonicalStep({
      comparisonId: comparison.comparisonId,
      workflowKind: comparison.workflowKind,
      variant: "optimized",
      nodeId: "optimization-study",
      nodeKind: "critic",
      runtimeRole: "critic",
      stepIndex: completedTrials,
      stepCount: trialBudget,
      lineage: ["optimization-study"],
      activeStateLanes: ["conversation"],
      outputText:
        `Completed ${completedTrials}/${trialBudget} optimization trials. Current ${current.selectionKey} scored ${
          aggregateScoreForEvaluation(current).toFixed(6)
        }; best so far is ${best.selectionKey} at ${aggregateScoreForEvaluation(best).toFixed(6)}.`,
      aggregateScore: aggregateScoreForEvaluation(best)
    })
  ),
  new SectionUpsert({
    section: optimizationStudyProgressSection({
      best,
      completedTrials,
      current,
      dimensions,
      trialBudget
    })
  })
]

const optimizationStudySections = ({
  comparison,
  dimensions,
  outcome
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: WorkflowComparisonSearchStudyOutcome
}): ReadonlyArray<EvidenceSection> => {
  const authoredScore = outcome.authored.execution.report.aggregateScore
  const winnerScore = outcome.winner.execution.report.aggregateScore

  return [
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationStudySummary,
      title: "Optimization Study Summary",
      items: [
        {
          _tag: "Scalar",
          key: workflowComparisonEvidenceItemKeys.trialBudget,
          label: "Trial budget",
          value: outcome.trialBudget,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Scalar",
          key: workflowComparisonEvidenceItemKeys.completedTrials,
          label: "Completed trials",
          value: outcome.snapshot.completedCount,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Comparison",
          key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedScore,
          label: "Winner vs authored optimized score",
          baseline: authoredScore,
          improved: winnerScore,
          unit: "score",
          direction: "higher-is-better"
        },
        {
          _tag: "Comparison",
          key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount,
          label: "Winner vs authored optimized node count",
          baseline: outcome.authored.execution.record.graph.nodes.length,
          improved: outcome.winner.execution.record.graph.nodes.length,
          unit: "count",
          direction: "higher-is-better"
        },
        itemText(
          "Recovered or improved authored optimized",
          winnerScore >= authoredScore ? "yes" : "no",
          workflowComparisonEvidenceItemKeys.recoveredOrImprovedAuthoredOptimized
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationWinner,
      title: "Optimization Winner",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.selectedKnobs,
          label: "Selected knobs",
          columns: ["Knob", "Choice"],
          rows: selectionRows({ dimensions, selection: outcome.winner.selection })
        },
        itemText(
          "Winner record",
          outcome.winner.execution.record.recordId,
          workflowComparisonEvidenceItemKeys.winnerRecord
        ),
        itemText(
          "Winner traversal",
          outcome.winner.execution.graphProjection.traversal.join(" -> "),
          workflowComparisonEvidenceItemKeys.winnerTraversal
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationSnapshot,
      title: "Optimization Snapshot",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.snapshotFacts,
          label: "Snapshot facts",
          columns: ["Field", "Value"],
          rows: [
            ["comparison", comparison.comparisonId],
            ["snapshot format", `${outcome.snapshot.snapshotFormatVersion}`],
            ["next trial number", `${outcome.snapshot.nextTrialNumber}`],
            ["completed count", `${outcome.snapshot.completedCount}`],
            ["trial count", `${outcome.snapshot.trials.length}`],
            ["study duration", `${outcome.snapshot.studyDuration}`],
            ["sampler kind", outcome.snapshot.samplerKind._tag],
            ["space fingerprint", outcome.snapshot.spaceFingerprint]
          ]
        },
        itemText(
          "Snapshot JSON",
          encodeStudySnapshotJson(outcome.snapshot),
          workflowComparisonEvidenceItemKeys.snapshotJson
        )
      ]
    },
    {
      key: workflowComparisonEvidenceSectionKeys.optimizationStudyEventTrace,
      title: "Optimization Study Event Trace",
      items: [
        {
          _tag: "Table",
          key: workflowComparisonEvidenceItemKeys.studyEvents,
          label: "Study events",
          columns: ["#", "Event", "Detail"],
          rows: outcome.events.map((event, index) => [
            `${index + 1}`,
            event._tag,
            formatEventDetail({ dimensions, event })
          ])
        }
      ]
    }
  ]
}

export const optimizationStudyCompletedEvents = ({
  comparison,
  dimensions,
  outcome
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: WorkflowComparisonSearchStudyOutcome
}): ReadonlyArray<EvidenceEvent> => {
  return [
    ...optimizationStudySections({ comparison, dimensions, outcome }).map((section) => new SectionAppend({ section })),
    new Choreography({ cue: new StageExit({ stageId: "optimization-study" }) })
  ]
}

export const workflowComparisonSearchDimensions = (
  comparison: FrozenWorkflowComparisonRun,
  plan: WorkflowComparisonRunPlan
): Effect.Effect<ReadonlyArray<WorkflowComparisonSearchDimension>, WorkflowComparisonExecutionError, never> =>
  searchDimensionsForComparison(comparison, plan)

export const replayWorkflowComparisonSearchSelection = ({
  comparison,
  dimensions,
  lane,
  selection
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly lane: WorkflowComparisonExecutionLane
  readonly selection: WorkflowComparisonSelectedKnobs
}): Effect.Effect<WorkflowComparisonSearchEvaluation, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  evaluateSelection({ comparison, dimensions, lane, selection })

export const runWorkflowComparisonSearchStudy = <R = never>({
  comparison,
  lane,
  plan,
  publishProgress = () => Effect.void
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly plan: WorkflowComparisonRunPlan
  readonly publishProgress?: WorkflowComparisonSearchProgressPublisher<R>
}): Effect.Effect<WorkflowComparisonSearchStudyOutcome, WorkflowComparisonExecutionError, R | DspProviderRuntime> =>
  Effect.scoped(
    Effect.gen(function*() {
      const dimensions = yield* searchDimensionsForComparison(comparison, plan)
      const space = searchSpaceForDimensions(dimensions)
      const trialBudget = dimensions.reduce((product, dimension) => product * dimension.choices.length, 1)
      const sampler = Sampler.tpe({
        seed: searchSeedForComparison(comparison),
        nStartupTrials: Math.min(4, trialBudget),
        nEiCandidates: Math.max(8, trialBudget)
      })
      const evaluationByKeyRef = yield* Ref.make<Readonly<Record<string, WorkflowComparisonSearchEvaluation>>>({})
      const handle = yield* Study.open({
        space,
        sampler,
        direction: "maximize",
        trials: trialBudget,
        objective: () => Effect.succeed(0)
      }).pipe(
        Effect.mapError(() => executionError(`Workflow comparison study setup failed for ${comparison.comparisonId}.`))
      )
      const eventFiber = yield* Effect.fork(Stream.runCollect(Study.events(handle)))

      yield* Effect.forEach(
        Arr.range(0, trialBudget - 1),
        () =>
          Study.ask(handle).pipe(
            Effect.mapError(() =>
              executionError(`Workflow comparison study reservation failed for ${comparison.comparisonId}.`)
            ),
            Effect.flatMap((asked) =>
              selectionFromConfig(asked.config).pipe(
                Effect.flatMap((selection) =>
                  evaluateSelection({ comparison, dimensions, lane, selection }).pipe(
                    Effect.tap((evaluation) =>
                      Ref.update(evaluationByKeyRef, (current) => ({
                        ...current,
                        [evaluation.selectionKey]: evaluation
                      }))
                    ),
                    Effect.flatMap((evaluation) =>
                      Study.tell(handle, asked.trialNumber, evaluation.execution.report.aggregateScore).pipe(
                        Effect.mapError(() =>
                          executionError(`Workflow comparison study scoring failed for ${comparison.comparisonId}.`)
                        ),
                        Effect.zipRight(Ref.get(evaluationByKeyRef)),
                        Effect.flatMap((evaluations) =>
                          Option.match(bestEvaluation(evaluations), {
                            onNone: () => Effect.void,
                            onSome: (best) =>
                              publishProgress(
                                optimizationStudyProgressEvents({
                                  best,
                                  comparison,
                                  completedTrials: Record.keys(evaluations).length,
                                  current: evaluation,
                                  dimensions,
                                  trialBudget
                                })
                              )
                          })
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
        { discard: true }
      )

      const outcome = yield* Study.result(handle).pipe(
        Effect.mapError(() =>
          executionError(`Workflow comparison study result assembly failed for ${comparison.comparisonId}.`)
        )
      )
      const snapshot = yield* Study.snapshot(handle).pipe(
        Effect.mapError(() =>
          executionError(`Workflow comparison study snapshot failed for ${comparison.comparisonId}.`)
        )
      )
      const bestSelectionKey = yield* singleObjectiveBestSelectionKey({ dimensions, outcome })
      const authoredSelection = authoredOptimizedSelection(comparison, plan)
      const authoredSelectionKey = selectionKey({ dimensions, selection: authoredSelection })
      const evaluations = yield* Ref.get(evaluationByKeyRef)
      const events = Chunk.toReadonlyArray(yield* Fiber.join(eventFiber))
      const winner = evaluations[bestSelectionKey]
      const authored = evaluations[authoredSelectionKey]

      return yield* Option.all({
        authored: Option.fromNullable(authored),
        winner: Option.fromNullable(winner)
      }).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(
              executionError(
                `Workflow comparison study did not retain authored and winner evaluations for ${comparison.comparisonId}.`
              )
            ),
          onSome: ({ authored, winner }) =>
            Effect.succeed({
              trialBudget,
              events,
              snapshot,
              authored,
              winner
            })
        })
      )
    })
  )
