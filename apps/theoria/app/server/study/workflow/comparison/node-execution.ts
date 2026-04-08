import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Match, Option, Ref, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import {
  ModuleParams,
  projectTraceObjectiveProjection,
  type TraceObjectiveProjection,
  type Usage
} from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"
import type {
  GraphVariant,
  NodeExecutionContract,
  RuntimeEvidence,
  WorkflowExecutionRecord,
  WorkflowStateLane
} from "effect-inference/Contracts"

import type {
  WorkflowComparisonExecutionLane,
  WorkflowComparisonTraceProjection
} from "../../../../contracts/study/workflow/comparison/run.js"
import { WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"
import { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { runtimeEvidenceForNodeExecution } from "./runtime-evidence.js"
import type { WorkflowComparisonSelectedKnobs } from "./runtime-plan.js"

type WorkflowExecutionState = Readonly<Record<WorkflowStateLane, ReadonlyArray<string>>>

const workflowNodeOutputSchema = {
  answer: Signature.describe(Schema.String, "Authored node output for downstream workflow state")
}

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const firstUserPrompt = (record: WorkflowExecutionRecord): string =>
  record.session.turns.find((turn) => turn.role === "user")?.content ?? "Summarize the authored graph outcome."

const inputContextForNode = ({
  node,
  record,
  state
}: {
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly state: WorkflowExecutionState
}): string => {
  const laneInputs = node.inputLanes.flatMap((lane) => state[lane])

  return laneInputs.length > 0 ? laneInputs.slice(-2).join(" ") : firstUserPrompt(record)
}

const knobValue = ({
  fallback,
  key,
  selectedKnobs
}: {
  readonly fallback: string
  readonly key: string
  readonly selectedKnobs: WorkflowComparisonSelectedKnobs
}): string =>
  Option.fromNullable(selectedKnobs[key]).pipe(
    Option.getOrElse(() => fallback)
  )

const responseLengthText = (responseLengthTarget: string): string =>
  Match.value(responseLengthTarget).pipe(
    Match.when("medium", () => "a compact paragraph"),
    Match.when("short", () => "a single compact sentence"),
    Match.orElse(() => "a concise response")
  )

const plannerFraming = (instructionProfile: string): string =>
  Match.value(instructionProfile).pipe(
    Match.when("stepwise", () => "in two compact steps"),
    Match.when("brief", () => "in one concise line"),
    Match.orElse(() => "with a concise planning note")
  )

const runtimePreferenceText = (runtimeProfile: string): string =>
  Match.value(runtimeProfile).pipe(
    Match.when("preferred", () => "the preferred stable runtime path"),
    Match.when("fastest", () => "the fastest available runtime path"),
    Match.orElse(() => "the resolved runtime path")
  )

const renderSurfaceText = (surfaceProfile: string): string =>
  Match.value(surfaceProfile).pipe(
    Match.when("sidebar", () => "sidebar surface"),
    Match.when("full-panel", () => "full-panel surface"),
    Match.orElse(() => "render surface")
  )

const relevantKnobSummary = ({
  node,
  selectedKnobs
}: {
  readonly node: NodeExecutionContract
  readonly selectedKnobs: WorkflowComparisonSelectedKnobs
}): string =>
  node.optimizationKnobRefs
    .flatMap((key) =>
      Option.fromNullable(selectedKnobs[key]).pipe(
        Option.match({
          onNone: (): ReadonlyArray<string> => [],
          onSome: (value): ReadonlyArray<string> => [`${key}=${value}`]
        })
      )
    )
    .join(", ")

const authoredAnswerForNode = ({
  comparison,
  node,
  record,
  selectedKnobs,
  state,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs: WorkflowComparisonSelectedKnobs
  readonly state: WorkflowExecutionState
  readonly variant: GraphVariant
}): string => {
  const inputContext = inputContextForNode({ node, record, state })
  const instructionProfile = knobValue({
    fallback: "brief",
    key: "instruction-profile",
    selectedKnobs
  })
  const responseLengthTarget = knobValue({
    fallback: "short",
    key: "response-length-target",
    selectedKnobs
  })
  const critiquePassBudget = knobValue({
    fallback: "1",
    key: "critique-pass-budget",
    selectedKnobs
  })
  const runtimeProfile = knobValue({
    fallback: "preferred",
    key: "runtime-profile",
    selectedKnobs
  })
  const retrievalDepth = knobValue({
    fallback: "1",
    key: "retrieval-depth",
    selectedKnobs
  })
  const surfaceProfile = knobValue({
    fallback: "sidebar",
    key: "surface-profile",
    selectedKnobs
  })

  return Match.value(node.nodeKind).pipe(
    Match.when(
      "planner",
      () =>
        `${variant} planner frames ${comparison.label.toLowerCase()} around ${inputContext} ${
          plannerFraming(instructionProfile)
        }. It foregrounds requested runtime, route family, and resolved runtime evidence.`
    ),
    Match.when(
      "critic",
      () =>
        `${variant} critic runs ${critiquePassBudget} critique pass${
          critiquePassBudget === "1" ? "" : "es"
        } and adds the missing runtime tradeoff, supporting evidence, and concise handoff that the current graph state still needs.`
    ),
    Match.when(
      "chat-handoff",
      () =>
        `${variant} handoff preserves conversation continuity, the latest route delta, and the user constraint before the next response node runs on ${
          runtimePreferenceText(runtimeProfile)
        }.`
    ),
    Match.when(
      "retrieval",
      () =>
        `${variant} retrieval surfaces ${retrievalDepth} supporting clue${
          retrievalDepth === "1" ? "" : "s"
        }, route memory, and grounding details from the active graph state for downstream nodes.`
    ),
    Match.when(
      "render-evaluator",
      () =>
        `${variant} render evaluator checks ${
          renderSurfaceText(surfaceProfile)
        } fit, narrow panel readability, and above-the-fold coverage before the answer is sealed.`
    ),
    Match.when(
      "responder",
      () =>
        `${variant} responder turns ${inputContext} into ${responseLengthText(responseLengthTarget)} that explains ${
          runtimePreferenceText(runtimeProfile)
        }, the route reason, and the most relevant supporting detail while staying readable in the ${
          renderSurfaceText(surfaceProfile)
        }.`
    ),
    Match.orElse(
      () => `${variant} ${node.nodeKind} executes on the shared workflow spine for ${comparison.workflowKind}.`
    )
  )
}

const responseEnvelopeFor = (answer: string): string => `[[ ## answer ## ]]\n${answer}`

const languageModelLayerForExecution = ({
  authoredAnswer,
  lane
}: {
  readonly authoredAnswer: string
  readonly lane: WorkflowComparisonExecutionLane
}) =>
  lane === "provider"
    ? DspProviderRuntime.pipe(
      Effect.flatMap((runtime) =>
        Option.match(runtime.layer, {
          onNone: () =>
            Effect.fail(
              executionError(
                Option.getOrElse(runtime.capability.reason, () =>
                  "Workflow comparison live provider runtime is not configured.")
              )
            ),
          onSome: Effect.succeed
        })
      )
    )
    : Effect.succeed(
      MockLanguageModel.layer(
        LanguageModel.LanguageModel,
        MockLanguageModel.fixed(responseEnvelopeFor(authoredAnswer))
      )
    )

const nodeInstructionFor = ({
  comparison,
  node,
  selectedKnobs,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly selectedKnobs: WorkflowComparisonSelectedKnobs
  readonly variant: GraphVariant
}): string =>
  `${comparison.label} runs a ${variant} ${comparison.workflowKind} graph. You are the ${node.nodeKind} node writing the next ${node.outputLane} lane update. Return a concise authored answer that preserves route reasoning, runtime provenance, and the most useful supporting detail.${
    Option.fromNullable(relevantKnobSummary({ node, selectedKnobs })).pipe(
      Option.filter((summary) => summary.length > 0),
      Option.match({ onNone: () => "", onSome: (summary) => ` Active knobs: ${summary}.` })
    )
  }`

const moduleParamsWithTextOutput = (params: ModuleParams): ModuleParams =>
  new ModuleParams({
    instructions: params.instructions,
    demos: params.demos,
    outputStrategy: "text",
    ...Option.fromNullable(params.temperature).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (temperature) => ({ temperature })
      })
    ),
    ...Option.fromNullable(params.maxTokens).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (maxTokens) => ({ maxTokens })
      })
    )
  })

const traceProjectionFrom = (
  traces: ReadonlyArray<Trace.Entry>
): Effect.Effect<TraceObjectiveProjection, WorkflowComparisonExecutionError, never> =>
  Option.fromNullable(traces[0]).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError("effect-dsp node execution produced no trace entry.")),
      onSome: (traceEntry) =>
        projectTraceObjectiveProjection(traceEntry).pipe(
          Effect.mapError(() => executionError("effect-dsp trace projection failed for a workflow node."))
        )
    })
  )

const nullableNumber = (value: Option.Option<number>): number | null =>
  value.pipe(
    Option.match({
      onNone: () => null,
      onSome: (resolved) => resolved
    })
  )

const workflowComparisonTraceProjection = (
  trace: TraceObjectiveProjection
): WorkflowComparisonTraceProjection => ({
  moduleId: trace.moduleId,
  signatureDescription: trace.signatureDescription,
  input: trace.input,
  prompt: trace.prompt,
  output: trace.output,
  score: nullableNumber(trace.score),
  rawResponse: trace.rawResponse,
  usage: {
    inputTokens: nullableNumber(trace.usage.inputTokens),
    outputTokens: nullableNumber(trace.usage.outputTokens),
    cached: trace.usage.cached
  },
  totalTokens: trace.totalTokens,
  durationMs: trace.durationMs,
  timestamp: trace.timestamp
})

export const executeWorkflowNode = ({
  comparison,
  lane,
  node,
  record,
  selectedKnobs,
  state,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs: WorkflowComparisonSelectedKnobs
  readonly state: WorkflowExecutionState
  readonly variant: GraphVariant
}): Effect.Effect<
  {
    readonly outputText: string
    readonly runtimeEvidence: RuntimeEvidence
    readonly trace: WorkflowComparisonTraceProjection
  },
  WorkflowComparisonExecutionError,
  DspProviderRuntime
> =>
  Module.withDiscoveryScope(
    Effect.gen(function*() {
      const authoredAnswer = authoredAnswerForNode({
        comparison,
        node,
        record,
        selectedKnobs,
        state,
        variant
      })
      const signature = yield* Signature.make(
        nodeInstructionFor({ comparison, node, selectedKnobs, variant }),
        {
          context: Signature.describe(Schema.String, "Latest workflow state presented to this node")
        },
        workflowNodeOutputSchema
      ).pipe(
        Effect.mapError(() => executionError(`Signature construction failed for workflow node ${node.nodeId}.`))
      )
      const moduleName = `workflow-comparison-${comparison.workflowKind}-${variant}-${node.nodeId}`
      const module = yield* Module.predict(moduleName, signature).pipe(
        Effect.mapError(() => executionError(`effect-dsp module construction failed for workflow node ${node.nodeId}.`))
      )
      const languageModelLayer = yield* languageModelLayerForExecution({ authoredAnswer, lane })

      yield* Ref.update(module.params, moduleParamsWithTextOutput)

      const runtime = yield* Trace.withUsageTracking(
        Trace.withTracing(
          module.forward({ context: inputContextForNode({ node, record, state }) }).pipe(
            Effect.provide(languageModelLayer)
          )
        )
      ).pipe(
        Effect.mapError(() => executionError(`effect-dsp runtime execution failed for workflow node ${node.nodeId}.`))
      )
      const output = runtime[0][0]
      const traces = runtime[0][1]
      const usage: Usage = runtime[1]
      const trace = yield* traceProjectionFrom(traces)
      const workflowTrace = workflowComparisonTraceProjection(trace)

      return {
        outputText: output.answer,
        runtimeEvidence: yield* runtimeEvidenceForNodeExecution({
          comparison,
          lane,
          node,
          trace: workflowTrace,
          usage,
          variant
        }),
        trace: workflowTrace
      }
    })
  )
