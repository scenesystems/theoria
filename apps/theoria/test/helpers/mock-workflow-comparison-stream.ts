import { Effect } from "effect"

import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  SectionAppend,
  SectionUpsert,
  StreamComplete
} from "../../app/contracts/evidence-stream.js"
import type { EvidenceItem } from "../../app/contracts/evidence.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys,
  workflowComparisonNodeExecutionSectionKey,
  workflowComparisonVariantOverviewSectionKey
} from "../../app/contracts/workflow/comparison-evidence-keys.js"
import { WorkflowComparisonCanonicalStep } from "../../app/contracts/workflow/comparison-step.js"
import type { WorkflowComparisonId } from "../../app/contracts/workflow/comparison.js"

type EvidenceSource = {
  readonly emitEvidence: (data: string) => void
}

type StreamMeta = {
  readonly requestId: string
  readonly buildSha: string
  readonly durationMs: number
}

type WorkflowScenarioFixture = {
  readonly baselineReplyNodeId: string
  readonly baselinePrompt: string
  readonly baselineOutput: string
  readonly baselineTraversal: ReadonlyArray<ReadonlyArray<string>>
  readonly optimizedRenderCheckOutput: string | null
  readonly optimizedReplyNodeId: string
  readonly optimizedPrompt: string
  readonly optimizedOutput: string
  readonly workflowKind: "task-first" | "chat-continuation" | "retrieval-required" | "render-sensitive"
  readonly winnerTraversal: ReadonlyArray<ReadonlyArray<string>>
}

const emitEvent = (
  source: EvidenceSource,
  eventJson: string
) =>
  Effect.sync(() => {
    source.emitEvidence(eventJson)
  })

const taskBriefingWorkflowScenarioFixture: WorkflowScenarioFixture = {
  baselineReplyNodeId: "responder",
  baselinePrompt: "Summarize the runtime route in one concise paragraph.",
  baselineOutput: "Baseline route briefing: the runtime selected the direct path but omitted critique context.",
  baselineTraversal: [["planner", "planner", "proposer"], ["responder", "responder", "task"]],
  optimizedRenderCheckOutput: null,
  optimizedReplyNodeId: "responder",
  optimizedPrompt: "Return the route reason with critique feedback and the supporting runtime evidence.",
  optimizedOutput:
    "Search winner route briefing: the graph adds a critique pass, keeps the response concise, and grounds the chosen runtime in the supporting evidence ledger.",
  workflowKind: "task-first",
  winnerTraversal: [["planner", "planner", "proposer"], ["critic", "critic", "critic"], [
    "responder",
    "responder",
    "task"
  ]]
}

const workflowScenarioFixtureById: Readonly<Record<WorkflowComparisonId, WorkflowScenarioFixture>> = {
  "task-briefing": taskBriefingWorkflowScenarioFixture,
  "chat-handoff": {
    baselineReplyNodeId: "reply",
    baselinePrompt: "Continue the handoff with the route reason in one short paragraph.",
    baselineOutput: "Baseline chat handoff: the reply stays concise but misses the retrieval-backed justification.",
    baselineTraversal: [["handoff", "chat-handoff", "teacher"], ["reply", "responder", "task"]],
    optimizedRenderCheckOutput:
      "Render check: the narrow-panel surface fits, but this evaluator output is not the user-facing reply.",
    optimizedReplyNodeId: "reply",
    optimizedPrompt: "Continue the handoff with retrieval context and render-aware guardrails.",
    optimizedOutput:
      "Search winner chat handoff: the graph retrieves the missing route memory, checks the narrow-panel render fit, and returns a grounded continuation.",
    workflowKind: "chat-continuation",
    winnerTraversal: [
      ["handoff", "chat-handoff", "teacher"],
      ["retrieval", "retrieval", "evaluator"],
      ["reply", "responder", "task"],
      ["render-check", "render-evaluator", "evaluator"]
    ]
  },
  "retrieval-required": {
    baselineReplyNodeId: "reply",
    baselinePrompt: "Explain the selected route and cite the supporting evidence.",
    baselineOutput:
      "Baseline retrieval briefing: the route summary names the outcome but omits the grounding evidence.",
    baselineTraversal: [["planner", "planner", "proposer"], ["reply", "responder", "task"]],
    optimizedRenderCheckOutput: null,
    optimizedReplyNodeId: "reply",
    optimizedPrompt: "Ground the route summary in retrieved evidence and bounded critique feedback.",
    optimizedOutput:
      "Search winner retrieval workflow: the graph retrieves the winning evidence, critiques the missing support, and returns a grounded route summary.",
    workflowKind: "retrieval-required",
    winnerTraversal: [
      ["planner", "planner", "proposer"],
      ["retrieval", "retrieval", "evaluator"],
      ["critic", "critic", "critic"],
      ["reply", "responder", "task"]
    ]
  },
  "render-sensitive": {
    baselineReplyNodeId: "reply",
    baselinePrompt: "Draft a sidebar-ready runtime summary with the route reason above the fold.",
    baselineOutput:
      "Baseline render-sensitive briefing: the response answers the task but overflows the intended surface.",
    baselineTraversal: [["planner", "planner", "proposer"], ["reply", "responder", "task"]],
    optimizedRenderCheckOutput:
      "Render check: the sidebar surface now keeps the route reason and remediation sentence above the fold.",
    optimizedReplyNodeId: "reply",
    optimizedPrompt: "Draft a render-aware summary that preserves the route reason and above-the-fold remediation.",
    optimizedOutput:
      "Search winner render-sensitive workflow: the graph shortens the summary, preserves the route reason, and keeps the critical remediation sentence visible in the sidebar.",
    workflowKind: "render-sensitive",
    winnerTraversal: [
      ["planner", "planner", "proposer"],
      ["critic", "critic", "critic"],
      ["reply", "responder", "task"],
      ["render-check", "render-evaluator", "evaluator"]
    ]
  }
}

const defaultWorkflowScenarioFixture = taskBriefingWorkflowScenarioFixture

const fixtureForComparison = (comparisonId: WorkflowComparisonId): WorkflowScenarioFixture =>
  workflowScenarioFixtureById[comparisonId] ?? defaultWorkflowScenarioFixture

const traversalText = (rows: ReadonlyArray<ReadonlyArray<string>>): string => rows.map((row) => row[0]).join(" -> ")

const keyedTextItem = (
  label: string,
  value: string,
  key: string
): Extract<EvidenceItem, { readonly _tag: "Text" }> => ({ _tag: "Text", key, label, value })

const keyedScalarItem = (
  format: "fixed" | "integer",
  key: string,
  label: string,
  unit: string,
  value: number
): Extract<EvidenceItem, { readonly _tag: "Scalar" }> => ({
  _tag: "Scalar",
  key,
  label,
  value,
  unit,
  format
})

export const emitWorkflowComparisonAuthoredStream = ({
  comparisonId,
  meta,
  source,
  summary
}: {
  readonly comparisonId: WorkflowComparisonId
  readonly meta: StreamMeta
  readonly source: EvidenceSource
  readonly summary: string
}): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const fixture = fixtureForComparison(comparisonId)

    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        canonicalStepEvent(
          new WorkflowComparisonCanonicalStep({
            comparisonId,
            workflowKind: fixture.workflowKind,
            variant: "baseline",
            nodeId: fixture.baselineReplyNodeId,
            nodeKind: "responder",
            runtimeRole: "task",
            stepIndex: 1,
            stepCount: 2,
            lineage: fixture.baselineTraversal.map((row) => row[0] ?? ""),
            activeStateLanes: ["conversation"],
            outputText: fixture.baselineOutput,
            aggregateScore: 0.62
          })
        )
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonVariantOverviewSectionKey("baseline"),
            title: "Baseline Graph",
            items: [
              {
                _tag: "Table",
                key: workflowComparisonEvidenceItemKeys.traversal,
                label: "Traversal",
                columns: ["Node", "Kind", "Role"],
                rows: fixture.baselineTraversal.map((row) => [...row])
              },
              keyedScalarItem(
                "integer",
                workflowComparisonEvidenceItemKeys.traversalSteps,
                "Traversal Steps",
                "steps",
                fixture.baselineTraversal.length
              )
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonNodeExecutionSectionKey({
              nodeId: fixture.baselineReplyNodeId,
              nodeKind: "responder",
              variant: "baseline"
            }),
            title: `Baseline · ${fixture.baselineReplyNodeId}`,
            items: [
              keyedTextItem("Output", fixture.baselineOutput, workflowComparisonEvidenceItemKeys.output),
              keyedTextItem("Prompt", fixture.baselinePrompt, workflowComparisonEvidenceItemKeys.prompt),
              keyedTextItem("Raw response", fixture.baselineOutput, workflowComparisonEvidenceItemKeys.rawResponse),
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.traceDuration, "Trace duration", "ms", 118),
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.totalTokens, "Total tokens", "tokens", 146)
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionUpsert({
          section: {
            key: workflowComparisonEvidenceSectionKeys.optimizationStudyProgress,
            title: "Optimization Study Progress",
            items: [
              keyedScalarItem(
                "integer",
                workflowComparisonEvidenceItemKeys.completedTrials,
                "Completed trials",
                "trials",
                1
              ),
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.trialBudget, "Trial budget", "trials", 4),
              keyedTextItem(
                "Current selection",
                "instruction-profile=stepwise · critique-pass-budget=2",
                workflowComparisonEvidenceItemKeys.currentSelection
              ),
              keyedScalarItem("fixed", workflowComparisonEvidenceItemKeys.currentScore, "Current score", "score", 0.84),
              keyedTextItem(
                "Best selection",
                "instruction-profile=stepwise · critique-pass-budget=2",
                workflowComparisonEvidenceItemKeys.bestSelection
              ),
              keyedScalarItem("fixed", workflowComparisonEvidenceItemKeys.bestScore, "Best score", "score", 0.84)
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonEvidenceSectionKeys.optimizationStudySummary,
            title: "Optimization Study Summary",
            items: [
              {
                _tag: "Comparison",
                key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedScore,
                label: "Winner vs authored optimized score",
                baseline: 0.84,
                improved: 0.91,
                unit: "score",
                direction: "higher-is-better"
              },
              {
                _tag: "Comparison",
                key: workflowComparisonEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount,
                label: "Winner vs authored optimized node count",
                baseline: 3,
                improved: 4,
                unit: "count",
                direction: "higher-is-better"
              },
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.trialBudget, "Trial budget", "trials", 4),
              keyedScalarItem(
                "integer",
                workflowComparisonEvidenceItemKeys.completedTrials,
                "Completed trials",
                "trials",
                4
              )
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonEvidenceSectionKeys.optimizationWinner,
            title: "Optimization Winner",
            items: [
              {
                _tag: "Table",
                key: workflowComparisonEvidenceItemKeys.selectedKnobs,
                label: "Selected knobs",
                columns: ["Knob", "Choice"],
                rows: [["instruction-profile", "stepwise"], ["critique-pass-budget", "2"]]
              },
              keyedTextItem(
                "Winner traversal",
                traversalText(fixture.winnerTraversal),
                workflowComparisonEvidenceItemKeys.winnerTraversal
              )
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        canonicalStepEvent(
          new WorkflowComparisonCanonicalStep({
            comparisonId,
            workflowKind: fixture.workflowKind,
            variant: "optimized",
            nodeId: fixture.optimizedReplyNodeId,
            nodeKind: "responder",
            runtimeRole: "task",
            stepIndex: 3,
            stepCount: fixture.winnerTraversal.length,
            lineage: fixture.winnerTraversal.map((row) => row[0] ?? ""),
            activeStateLanes: ["conversation", "render"],
            outputText: fixture.optimizedOutput,
            aggregateScore: 0.91
          })
        )
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonVariantOverviewSectionKey("optimized"),
            title: "Optimized Graph",
            items: [
              {
                _tag: "Table",
                key: workflowComparisonEvidenceItemKeys.traversal,
                label: "Traversal",
                columns: ["Node", "Kind", "Role"],
                rows: fixture.winnerTraversal.map((row) => [...row])
              },
              keyedScalarItem(
                "integer",
                workflowComparisonEvidenceItemKeys.traversalSteps,
                "Traversal Steps",
                "steps",
                fixture.winnerTraversal.length
              )
            ]
          }
        })
      )
    )
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonNodeExecutionSectionKey({
              nodeId: fixture.optimizedReplyNodeId,
              nodeKind: "responder",
              variant: "optimized"
            }),
            title: `Optimized · ${fixture.optimizedReplyNodeId}`,
            items: [
              keyedTextItem("Output", fixture.optimizedOutput, workflowComparisonEvidenceItemKeys.output),
              keyedTextItem("Prompt", fixture.optimizedPrompt, workflowComparisonEvidenceItemKeys.prompt),
              keyedTextItem("Raw response", fixture.optimizedOutput, workflowComparisonEvidenceItemKeys.rawResponse),
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.traceDuration, "Trace duration", "ms", 164),
              keyedScalarItem("integer", workflowComparisonEvidenceItemKeys.totalTokens, "Total tokens", "tokens", 188)
            ]
          }
        })
      )
    )
    yield* Effect.if(fixture.optimizedRenderCheckOutput !== null, {
      onTrue: () =>
        emitEvent(
          source,
          encodeEvidenceEventJson(
            new SectionAppend({
              section: {
                key: workflowComparisonNodeExecutionSectionKey({
                  nodeId: "render-check",
                  nodeKind: "render-evaluator",
                  variant: "optimized"
                }),
                title: "Optimized · render-check",
                items: [
                  keyedTextItem(
                    "Output",
                    fixture.optimizedRenderCheckOutput ?? "",
                    workflowComparisonEvidenceItemKeys.output
                  ),
                  keyedTextItem(
                    "Prompt",
                    "Evaluate whether the reply fits the narrow-panel surface.",
                    workflowComparisonEvidenceItemKeys.prompt
                  ),
                  keyedTextItem(
                    "Raw response",
                    fixture.optimizedRenderCheckOutput ?? "",
                    workflowComparisonEvidenceItemKeys.rawResponse
                  ),
                  keyedScalarItem(
                    "integer",
                    workflowComparisonEvidenceItemKeys.traceDuration,
                    "Trace duration",
                    "ms",
                    93
                  ),
                  keyedScalarItem(
                    "integer",
                    workflowComparisonEvidenceItemKeys.totalTokens,
                    "Total tokens",
                    "tokens",
                    57
                  )
                ]
              }
            })
          )
        ),
      onFalse: () => Effect.void
    })
    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        new SectionAppend({
          section: {
            key: workflowComparisonEvidenceSectionKeys.comparisonDelta,
            title: "Comparison Delta",
            items: [
              {
                _tag: "Comparison",
                key: workflowComparisonEvidenceItemKeys.aggregateScore,
                label: "Aggregate Score",
                baseline: 0.62,
                improved: 0.91,
                unit: "score",
                direction: "higher-is-better"
              },
              {
                _tag: "Comparison",
                key: workflowComparisonEvidenceItemKeys.graphNodes,
                label: "Graph Nodes",
                baseline: 2,
                improved: 4,
                unit: "count",
                direction: "higher-is-better"
              }
            ]
          }
        })
      )
    )
    yield* emitEvent(source, encodeEvidenceEventJson(new StreamComplete({ summary, meta })))
  })
