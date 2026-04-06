import { Effect, Match, Option, Ref, Schema, Stream } from "effect"
import * as Arr from "effect/Array"
import { Sampler, SearchSpace, Study } from "effect-search"
import * as SearchStudyEvent from "effect-search/StudyEvent"
import type { StudyEvent } from "effect-search/StudyEvent"
import {
  type GraphExecutionManifest,
  type GraphExecutionProjection,
  type NodeExecutionContract,
  type WorkflowExecutionRecord,
  type WorkflowStateLane
} from "effect-inference/Contracts"

import { canonicalStepEvent, Choreography, SectionAppend, StageEnter, StageExit, type EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { EvidenceItem, EvidenceSection } from "../../contracts/evidence.js"
import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonVariantExecution,
  WorkflowComparisonVariantExecution as WorkflowComparisonVariantExecutionSchema
} from "../../contracts/workflow/comparison-run.js"
import { WorkflowComparisonCanonicalStep } from "../../contracts/workflow/comparison-step.js"
import { makeWorkflowExecutionRecord } from "./decode.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { evaluateVariantExecutionEffect } from "./evaluation.js"
import {
  activeStateLanesForState,
  advanceExecutionState,
  finalizeVariantExecution,
  initialExecutionState,
  nodeExecutionForVariant,
  prepareVariantPlanForRecord,
  type WorkflowComparisonSelectedKnobs,
  WorkflowComparisonSelectedKnobsSchema
} from "./runtime.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

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
    Match.exhaustive
  )

const categoricalDimension = (choices: ReadonlyArray<string>) =>
  Arr.matchLeft(choices, {
    onEmpty: () => SearchSpace.categorical(["unreachable-empty-choice"]),
    onNonEmpty: (head, tail) => SearchSpace.categorical([head, ...tail])
  })

const searchDimensionsForComparison = (
  comparison: FrozenWorkflowComparisonRun
): Effect.Effect<ReadonlyArray<WorkflowComparisonSearchDimension>, WorkflowComparisonExecutionError, never> => {
  const dimensions = comparison.optimized.record.graph.optimizationKnobs.map((knob) => ({
    key: knob.key,
    choices: knob.choices
  }))

  return Arr.some(dimensions, (dimension) => dimension.choices.length === 0)
    ? Effect.fail(
      executionError(`Workflow comparison ${comparison.comparisonId} declared an empty optimization knob choice set.`)
    )
    : Effect.succeed(dimensions)
}

const searchSpaceForDimensions = (dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>) =>
  SearchSpace.unsafeMake(
    dimensions.reduce<Readonly<Record<string, Schema.Schema<string>>>>(
      (definition, dimension) => ({
        ...definition,
        [dimension.key]: categoricalDimension(dimension.choices)
      }),
      {}
    )
  )

const authoredOptimizedSelection = (
  comparison: FrozenWorkflowComparisonRun
): WorkflowComparisonSelectedKnobs =>
  comparison.optimized.record.graph.optimizationKnobs.reduce<WorkflowComparisonSelectedKnobs>(
    (selection, knob) => ({
      ...selection,
      [knob.key]: knob.choices[0] ?? ""
    }),
    {}
  )

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
}): string =>
  selectionKey({ dimensions, selection }).replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "")

const optimizationKnobByKey = (manifest: GraphExecutionManifest): Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>> =>
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
        })),
    true
  )

const nodeIds = (nodes: ReadonlyArray<NodeExecutionContract>): ReadonlyArray<string> =>
  nodes.map((node) => node.nodeId)

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
}): Effect.Effect<WorkflowComparisonSearchEvaluation, WorkflowComparisonExecutionError, never> =>
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
    const nodeExecutions = yield* Effect.forEach(indexedTraversal, ({ nodeId, stepCount, stepIndex }) =>
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

const selectionFromConfig = (config: Readonly<Record<string, unknown>>): WorkflowComparisonSelectedKnobs =>
  Object.entries(config).reduce<WorkflowComparisonSelectedKnobs>(
    (selection, [key, value]) =>
      typeof value === "string"
        ? {
          ...selection,
          [key]: value
        }
        : selection,
    {}
  )

const singleObjectiveBestSelectionKey = ({
  dimensions,
  outcome
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: Awaited<ReturnType<typeof Study.result>>
}): Effect.Effect<string, WorkflowComparisonExecutionError, never> =>
  Match.value(outcome).pipe(
    Match.tag("SingleObjective", ({ bestTrial }) =>
      Effect.succeed(
        selectionKey({
          dimensions,
          selection: selectionFromConfig(bestTrial.config)
        })
      )),
    Match.tag("MultiObjective", () =>
      Effect.fail(
        executionError("Workflow comparison search opened a multi-objective study for a single-score optimization lane.")
      )),
    Match.exhaustive
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

const formatEventDetail = ({
  dimensions,
  event
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly event: StudyEvent
}): string =>
  SearchStudyEvent.matchStudyEvent<string>({
    TrialStarted: ({ config, trialNumber }) =>
      `trial ${trialNumber} reserved · ${formatSelection({ dimensions, selection: selectionFromConfig(config) })}`,
    TrialCompleted: ({ trialNumber, value }) => `trial ${trialNumber} completed · score ${value.toFixed(6)}`,
    BestUpdated: ({ trialNumber, value }) => `best updated by trial ${trialNumber} · score ${value.toFixed(6)}`,
    TrialReported: ({ decision, step, trialNumber, value }) =>
      `trial ${trialNumber} reported ${value.toFixed(6)} at step ${step} · ${decision._tag}`,
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
          onSome: (value) => `bracket ${bracketIndex} completed · best ${value.toFixed(6)} · ${rounds} rounds`
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

const itemText = (label: string, value: string): EvidenceItem => ({
  _tag: "Text",
  label,
  value
})

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
      title: "Optimization Study Summary",
      items: [
        {
          _tag: "Scalar",
          label: "Trial budget",
          value: outcome.trialBudget,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Scalar",
          label: "Completed trials",
          value: outcome.snapshot.completedCount,
          unit: "trials",
          format: "integer"
        },
        {
          _tag: "Comparison",
          label: "Winner vs authored optimized score",
          baseline: authoredScore,
          improved: winnerScore,
          unit: "score",
          direction: "higher-is-better"
        },
        {
          _tag: "Comparison",
          label: "Winner vs authored optimized node count",
          baseline: outcome.authored.execution.record.graph.nodes.length,
          improved: outcome.winner.execution.record.graph.nodes.length,
          unit: "count",
          direction: "higher-is-better"
        },
        itemText(
          "Recovered or improved authored optimized",
          winnerScore >= authoredScore ? "yes" : "no"
        )
      ]
    },
    {
      title: "Optimization Winner",
      items: [
        {
          _tag: "Table",
          label: "Selected knobs",
          columns: ["Knob", "Choice"],
          rows: selectionRows({ dimensions, selection: outcome.winner.selection })
        },
        itemText("Winner record", outcome.winner.execution.record.recordId),
        itemText("Winner traversal", outcome.winner.execution.graphProjection.traversal.join(" -> "))
      ]
    },
    {
      title: "Optimization Snapshot",
      items: [
        {
          _tag: "Table",
          label: "Snapshot facts",
          columns: ["Field", "Value"],
          rows: [
            ["comparison", comparison.comparisonId],
            ["snapshot format", `${outcome.snapshot.snapshotFormatVersion}`],
            ["next trial number", `${outcome.snapshot.nextTrialNumber}`],
            ["completed count", `${outcome.snapshot.completedCount}`],
            ["trial count", `${outcome.snapshot.trials.length}`],
            ["study duration", `${outcome.snapshot.studyDuration}`],
            ["sampler kind", outcome.snapshot.samplerKind],
            ["space fingerprint", outcome.snapshot.spaceFingerprint]
          ]
        },
        itemText("Snapshot JSON", JSON.stringify(outcome.snapshot))
      ]
    },
    {
      title: "Optimization Study Event Trace",
      items: [
        {
          _tag: "Table",
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

export const optimizationStudyEvidenceEvents = ({
  comparison,
  dimensions,
  outcome
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly outcome: WorkflowComparisonSearchStudyOutcome
}): ReadonlyArray<EvidenceEvent> => {
  const winnerScore = outcome.winner.execution.report.aggregateScore

  return [
    new Choreography({ cue: new StageEnter({ stageId: "optimization-study", params: { trialBudget: outcome.trialBudget } }) }),
    ...optimizationStudySections({ comparison, dimensions, outcome }).map((section) => new SectionAppend({ section })),
    canonicalStepEvent(
      new WorkflowComparisonCanonicalStep({
        comparisonId: comparison.comparisonId,
        workflowKind: comparison.workflowKind,
        variant: "optimized",
        nodeId: "optimization-study",
        nodeKind: "critic",
        runtimeRole: "critic",
        stepIndex: 0,
        stepCount: 0,
        lineage: ["optimization-study"],
        activeStateLanes: ["conversation"],
        outputText: `Optimization study selected ${outcome.winner.execution.record.recordId} with score ${winnerScore.toFixed(6)}.`,
        aggregateScore: winnerScore
      })
    ),
    new Choreography({ cue: new StageExit({ stageId: "optimization-study" }) })
  ]
}

export const workflowComparisonSearchDimensions = (
  comparison: FrozenWorkflowComparisonRun
): Effect.Effect<ReadonlyArray<WorkflowComparisonSearchDimension>, WorkflowComparisonExecutionError, never> =>
  searchDimensionsForComparison(comparison)

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
}): Effect.Effect<WorkflowComparisonSearchEvaluation, WorkflowComparisonExecutionError, never> =>
  evaluateSelection({ comparison, dimensions, lane, selection })

export const runWorkflowComparisonSearchStudy = ({
  comparison,
  lane
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
}): Effect.Effect<WorkflowComparisonSearchStudyOutcome, WorkflowComparisonExecutionError, never> =>
  Effect.scoped(
    Effect.gen(function*() {
      const dimensions = yield* searchDimensionsForComparison(comparison)
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
        Array.from({ length: trialBudget }, (_unused, index) => index),
        () =>
          Study.ask(handle).pipe(
            Effect.mapError(() => executionError(`Workflow comparison study reservation failed for ${comparison.comparisonId}.`)),
            Effect.flatMap((asked) => {
              const selection = selectionFromConfig(asked.config)

              return evaluateSelection({ comparison, dimensions, lane, selection }).pipe(
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
                    )
                  )
                )
              )
            }),
        { discard: true }
      )

      const outcome = yield* Study.result(handle).pipe(
        Effect.mapError(() => executionError(`Workflow comparison study result assembly failed for ${comparison.comparisonId}.`))
      )
      const snapshot = yield* Study.snapshot(handle).pipe(
        Effect.mapError(() => executionError(`Workflow comparison study snapshot failed for ${comparison.comparisonId}.`))
      )
      const bestSelectionKey = yield* singleObjectiveBestSelectionKey({ dimensions, outcome })
      const authoredSelection = authoredOptimizedSelection(comparison)
      const authoredSelectionKey = selectionKey({ dimensions, selection: authoredSelection })
      const evaluations = yield* Ref.get(evaluationByKeyRef)
      const events = Chunk.toReadonlyArray(yield* Effect.join(eventFiber))
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
