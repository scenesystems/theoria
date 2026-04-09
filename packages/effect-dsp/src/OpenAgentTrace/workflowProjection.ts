/**
 * Workflow and example projections for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */
import { digestSchemaValue } from "@scenesystems/digest"
import { Effect, Option, Schema } from "effect"
import {
  EvaluationCaseSchema,
  EvaluationContractSchema,
  GraphExecutionManifestSchema,
  SessionManifestSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

import { Example } from "../Example/index.js"
import { syntheticCoverageGaps } from "./projectionCoverage.js"
import { ExampleProjection, WorkflowProjection } from "./projectionSchema.js"
import {
  assistantUsageProjection,
  blockText,
  isMessageEvent,
  messageText,
  profileFamilyFrom,
  PROJECTION_VERSION,
  workflowKindFrom
} from "./projectionShared.js"
import { decodeOpenAgentTraceContentDigest, type OpenAgentTraceRecord } from "./schema.js"

const expectedSignalsFrom = (
  turns: ReadonlyArray<{ readonly role: string; readonly content: string }>,
  index: number
) =>
  Option.match(Option.fromNullable(turns.slice(index + 1).find((candidate) => candidate.role === "assistant")), {
    onNone: () => [],
    onSome: (turn) => [turn.content]
  })

/**
 * Project one normalized trace into the reusable workflow-record family owned by `effect-inference/Contracts`.
 *
 * @since 0.2.0
 * @category combinators
 */
export const projectWorkflow = (record: OpenAgentTraceRecord) =>
  Effect.gen(function*() {
    const workflowKind = workflowKindFrom(record)
    const messageEvents = record.events.filter(isMessageEvent)
    const turns = messageEvents.map((event) => ({
      turnId: event.eventId,
      role: event.actor.actorKind === "assistant" ? "assistant" : event.actor.actorKind === "tool" ? "tool" : "user",
      content: messageText(event)
    }))
    const contextEntries = record.events.flatMap((event) =>
      event.eventKind === "compaction" || event.eventKind === "branch-summary"
        ? [event.summaryText]
        : event.eventKind === "custom-message"
        ? (event.contentBlocks ?? []).map(blockText)
        : event.eventKind === "label"
        ? [event.label ?? ""]
        : event.eventKind === "session-info"
        ? [event.sessionName ?? ""]
        : []
    )
    const firstUserTurn = turns.find((turn) => turn.role === "user")
    const session = yield* Schema.decodeUnknown(SessionManifestSchema)({
      sessionId: record.session.sessionId,
      workflowKind,
      turns,
      stateLanes: [
        ...(workflowKind === "task-first" && firstUserTurn ? [{ lane: "task", entries: [firstUserTurn.content] }] : []),
        ...(contextEntries.length > 0
          ? [{ lane: "context", entries: contextEntries.filter((entry) => entry.length > 0) }]
          : []),
        ...(turns.length > 0 ? [{ lane: "conversation", entries: turns.map((turn) => turn.content) }] : [])
      ]
    })
    const workflowRecord = yield* Schema.decodeUnknown(WorkflowExecutionRecordSchema)({
      recordId: `${record.recordId}:workflow`,
      workflowKind,
      session,
      graph: yield* Schema.decodeUnknown(GraphExecutionManifestSchema)({
        manifestId: `workflow:${record.recordId}`,
        workflowKind,
        variant: "baseline",
        nodes: workflowKind === "chat-continuation"
          ? [
            {
              nodeId: "chat-handoff",
              nodeKind: "chat-handoff",
              runtimeRole: "proposer",
              inputLanes: ["conversation", "context"],
              outputLane: "conversation",
              loopPolicy: "single-pass",
              optimizationKnobRefs: ["instruction-profile"]
            },
            {
              nodeId: "chat-responder",
              nodeKind: "responder",
              runtimeRole: "proposer",
              inputLanes: ["conversation", "context"],
              outputLane: "conversation",
              loopPolicy: "single-pass",
              optimizationKnobRefs: ["response-length-target"]
            }
          ]
          : [
            {
              nodeId: "task-planner",
              nodeKind: "planner",
              runtimeRole: "task",
              inputLanes: ["task", "context"],
              outputLane: "context",
              loopPolicy: "single-pass",
              optimizationKnobRefs: ["instruction-profile"]
            },
            {
              nodeId: "task-responder",
              nodeKind: "responder",
              runtimeRole: "proposer",
              inputLanes: ["task", "context", "conversation"],
              outputLane: "conversation",
              loopPolicy: "single-pass",
              optimizationKnobRefs: ["response-length-target"]
            }
          ],
        edges: workflowKind === "chat-continuation"
          ? [{
            edgeId: "chat-handoff-to-chat-responder",
            kind: "handoff",
            fromNodeId: "chat-handoff",
            toNodeId: "chat-responder"
          }]
          : [{
            edgeId: "task-planner-to-task-responder",
            kind: "next",
            fromNodeId: "task-planner",
            toNodeId: "task-responder"
          }],
        optimizationKnobs: workflowKind === "chat-continuation"
          ? [
            { key: "instruction-profile", kind: "instruction-profile", choices: ["baseline", "continuation-aware"] },
            { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
          ]
          : [
            { key: "instruction-profile", kind: "instruction-profile", choices: ["baseline", "summary-first"] },
            { key: "response-length-target", kind: "response-length-target", choices: ["short", "medium"] }
          ]
      }),
      projection: {
        manifestId: `workflow:${record.recordId}`,
        entryNodeId: workflowKind === "chat-continuation" ? "chat-handoff" : "task-planner",
        terminalNodeIds: [workflowKind === "chat-continuation" ? "chat-responder" : "task-responder"],
        activeStateLanes: session.stateLanes.map((lane) => lane.lane)
      },
      evaluation: yield* Schema.decodeUnknown(EvaluationContractSchema)({
        workflowKind,
        profileId: `open-agent-trace:${workflowKind}:v${PROJECTION_VERSION}`,
        profileFamily: profileFamilyFrom(workflowKind),
        cases: turns.flatMap((turn, index) =>
          turn.role === "user"
            ? [{
              caseId: turn.turnId,
              prompt: turn.content,
              expectedSignals: expectedSignalsFrom(turns, index),
              renderCritical: false
            }]
            : []
        )
      })
    })
    const usageProvenance = yield* Effect.forEach(
      messageEvents.filter((event) => Option.isSome(Option.fromNullable(event.piTurnProvenance))),
      assistantUsageProjection,
      { concurrency: 1 }
    )

    return WorkflowProjection.make({
      projectionKind: "workflow-record",
      workflowRecord,
      coverageGaps: [...record.coverageGaps, ...syntheticCoverageGaps(record)],
      usageProvenance
    })
  })

/**
 * Project one normalized trace into optimization-ready examples and comparison cases.
 *
 * @since 0.2.0
 * @category combinators
 */
export const projectExamples = (record: OpenAgentTraceRecord) =>
  Effect.gen(function*() {
    const workflowProjection = yield* projectWorkflow(record)
    const candidateExamples = workflowProjection.workflowRecord.evaluation.cases.map((value) =>
      Example.make({
        input: {
          prompt: value.prompt,
          workflowKind: workflowProjection.workflowRecord.workflowKind,
          sessionId: record.source.sessionId
        },
        output: value.expectedSignals[0]
          ? { expectedSignal: value.expectedSignals[0], expectedSignals: value.expectedSignals }
          : undefined
      })
    )
    const examples = yield* Schema.decodeUnknown(Schema.NonEmptyArray(Example))(candidateExamples)
    const comparisonCases = yield* Schema.decodeUnknown(Schema.NonEmptyArray(EvaluationCaseSchema))(
      workflowProjection.workflowRecord.evaluation.cases
    )
    const examplesDigest = yield* Effect.flatMap(
      digestSchemaValue(Schema.NonEmptyArray(Example), examples),
      decodeOpenAgentTraceContentDigest
    )
    const comparisonCasesDigest = yield* Effect.flatMap(
      digestSchemaValue(Schema.NonEmptyArray(EvaluationCaseSchema), comparisonCases),
      decodeOpenAgentTraceContentDigest
    )

    return ExampleProjection.make({
      projectionKind: "example-set",
      workflowKind: workflowProjection.workflowRecord.workflowKind,
      optimizationKnobs: workflowProjection.workflowRecord.graph.optimizationKnobs,
      examples,
      comparisonCases,
      coverageGaps: workflowProjection.coverageGaps,
      usageProvenance: workflowProjection.usageProvenance,
      examplesDigest,
      comparisonCasesDigest
    })
  })
