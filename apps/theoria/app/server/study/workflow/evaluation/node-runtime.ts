import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Option, Ref, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import { ModuleParams, TraceObjectiveProjection, type Usage } from "effect-dsp/contracts"
import { MockLanguageModel } from "effect-dsp/test"
import type {
  GraphVariant,
  NodeExecutionContract,
  RuntimeEvidence,
  WorkflowExecutionRecord
} from "effect-inference/Contracts"

import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import {
  WorkflowStudyExecutionError,
  type WorkflowTraceProjection
} from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { WorkflowExecutionState } from "./execution-state.js"
import { authoredAnswerForNode, inputContextForNode, nodeInstructionFor } from "./node-authoring.js"
import { runtimeEvidenceForNodeExecution } from "./runtime-evidence.js"

const workflowNodeOutputSchema = {
  answer: Signature.describe(Schema.String, "Authored node output for downstream workflow state")
}

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const responseEnvelopeFor = (answer: string): string => `[[ ## answer ## ]]\n${answer}`

const languageModelLayerForExecution = ({
  authoredAnswer,
  lane
}: {
  readonly authoredAnswer: string
  readonly lane: WorkflowExecutionLane
}) =>
  lane === "provider"
    ? DspProviderRuntime.pipe(
      Effect.flatMap((runtime) =>
        Option.match(runtime.layer, {
          onNone: () =>
            Effect.fail(
              executionError(
                Option.getOrElse(runtime.capability.reason, () => "Workflow live provider runtime is not configured.")
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
): Effect.Effect<TraceObjectiveProjection, WorkflowStudyExecutionError, never> =>
  Option.fromNullable(traces[0]).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError("effect-dsp node execution produced no trace entry.")),
      onSome: (traceEntry) =>
        TraceObjectiveProjection.fromTraceEntry(traceEntry).pipe(
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

const workflowTraceProjection = (
  trace: TraceObjectiveProjection
): WorkflowTraceProjection => ({
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
  workflowRun,
  lane,
  node,
  record,
  selectedKnobs,
  state,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs: WorkflowSelectedKnobs
  readonly state: WorkflowExecutionState
  readonly variant: GraphVariant
}): Effect.Effect<
  {
    readonly outputText: string
    readonly runtimeEvidence: RuntimeEvidence
    readonly trace: WorkflowTraceProjection
  },
  WorkflowStudyExecutionError,
  DspProviderRuntime
> =>
  Module.withDiscoveryScope(
    Effect.gen(function*() {
      const authoredAnswer = authoredAnswerForNode({
        workflowRun,
        node,
        record,
        selectedKnobs,
        state,
        variant
      })
      const signature = yield* Signature.make(
        nodeInstructionFor({ workflowRun, node, selectedKnobs, variant }),
        {
          context: Signature.describe(Schema.String, "Latest workflow state presented to this node")
        },
        workflowNodeOutputSchema
      ).pipe(
        Effect.mapError(() => executionError(`Signature construction failed for workflow node ${node.nodeId}.`))
      )
      const moduleName = `workflow-${workflowRun.workflowKind}-${variant}-${node.nodeId}`
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
      const workflowTrace = workflowTraceProjection(trace)

      return {
        outputText: output.answer,
        runtimeEvidence: yield* runtimeEvidenceForNodeExecution({
          workflowRun,
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
