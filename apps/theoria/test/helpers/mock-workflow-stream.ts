import { Effect, Option } from "effect"

import type { EvidenceItem } from "../../app/contracts/evidence/item.js"
import {
  canonicalStepEvent,
  encodeEvidenceEventJson,
  SectionAppend,
  SectionUpsert,
  StreamComplete
} from "../../app/contracts/evidence/stream.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceItemLabels,
  workflowEvidenceSectionKeys,
  workflowEvidenceSectionTitleForKey,
  workflowNodeExecutionSectionKey,
  workflowVariantOverviewSectionKey
} from "../../app/contracts/study/workflow/evidence.js"
import {
  chatHandoffWorkflowSessionId,
  renderSensitiveWorkflowSessionId,
  retrievalRequiredWorkflowSessionId,
  taskBriefingWorkflowSessionId
} from "../../app/contracts/study/workflow/fixture-manifest.js"
import type { WorkflowSeedId } from "../../app/contracts/study/workflow/manifest.js"
import { WorkflowCanonicalStep } from "../../app/contracts/study/workflow/step.js"

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

const workflowScenarioFixtureById: Readonly<Record<WorkflowSeedId, WorkflowScenarioFixture>> = {
  [taskBriefingWorkflowSessionId]: taskBriefingWorkflowScenarioFixture,
  [chatHandoffWorkflowSessionId]: {
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
  [retrievalRequiredWorkflowSessionId]: {
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
  [renderSensitiveWorkflowSessionId]: {
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

const fixtureForScenario = (seedId: WorkflowSeedId): WorkflowScenarioFixture =>
  workflowScenarioFixtureById[seedId] ?? defaultWorkflowScenarioFixture

const traversalText = (rows: ReadonlyArray<ReadonlyArray<string>>): string => rows.map((row) => row[0]).join(" -> ")

const workflowSectionTitle = (key: string): string => workflowEvidenceSectionTitleForKey(Option.some(key)) ?? key

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

export const emitWorkflowAuthoredStream = ({
  seedId,
  meta,
  source,
  summary
}: {
  readonly seedId: WorkflowSeedId
  readonly meta: StreamMeta
  readonly source: EvidenceSource
  readonly summary: string
}): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const fixture = fixtureForScenario(seedId)

    yield* emitEvent(
      source,
      encodeEvidenceEventJson(
        canonicalStepEvent(
          new WorkflowCanonicalStep({
            seedId,
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
            key: workflowVariantOverviewSectionKey("baseline"),
            title: workflowSectionTitle(workflowVariantOverviewSectionKey("baseline")),
            items: [
              {
                _tag: "Table",
                key: workflowEvidenceItemKeys.traversal,
                label: workflowEvidenceItemLabels.traversal,
                columns: ["Node", "Kind", "Role"],
                rows: fixture.baselineTraversal.map((row) => [...row])
              },
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.traversalSteps,
                workflowEvidenceItemLabels.traversalSteps,
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
            key: workflowNodeExecutionSectionKey({
              nodeId: fixture.baselineReplyNodeId,
              nodeKind: "responder",
              variant: "baseline"
            }),
            title: workflowSectionTitle(
              workflowNodeExecutionSectionKey({
                nodeId: fixture.baselineReplyNodeId,
                nodeKind: "responder",
                variant: "baseline"
              })
            ),
            items: [
              keyedTextItem(workflowEvidenceItemLabels.output, fixture.baselineOutput, workflowEvidenceItemKeys.output),
              keyedTextItem(workflowEvidenceItemLabels.prompt, fixture.baselinePrompt, workflowEvidenceItemKeys.prompt),
              keyedTextItem(
                workflowEvidenceItemLabels.rawResponse,
                fixture.baselineOutput,
                workflowEvidenceItemKeys.rawResponse
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.traceDuration,
                workflowEvidenceItemLabels.traceDuration,
                "ms",
                118
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.totalTokens,
                workflowEvidenceItemLabels.totalTokens,
                "tokens",
                146
              )
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
            key: workflowEvidenceSectionKeys.optimizationStudyProgress,
            title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationStudyProgress),
            items: [
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.completedTrials,
                workflowEvidenceItemLabels.completedTrials,
                "trials",
                1
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.trialBudget,
                workflowEvidenceItemLabels.trialBudget,
                "trials",
                4
              ),
              keyedTextItem(
                workflowEvidenceItemLabels.currentSelection,
                "instruction-profile=stepwise · critique-pass-budget=2",
                workflowEvidenceItemKeys.currentSelection
              ),
              keyedScalarItem(
                "fixed",
                workflowEvidenceItemKeys.currentScore,
                workflowEvidenceItemLabels.currentScore,
                "score",
                0.84
              ),
              keyedTextItem(
                workflowEvidenceItemLabels.bestSelection,
                "instruction-profile=stepwise · critique-pass-budget=2",
                workflowEvidenceItemKeys.bestSelection
              ),
              keyedScalarItem(
                "fixed",
                workflowEvidenceItemKeys.bestScore,
                workflowEvidenceItemLabels.bestScore,
                "score",
                0.84
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
            key: workflowEvidenceSectionKeys.optimizationStudySummary,
            title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationStudySummary),
            items: [
              {
                _tag: "Comparison",
                key: workflowEvidenceItemKeys.winnerVsAuthoredOptimizedScore,
                label: workflowEvidenceItemLabels.winnerVsAuthoredOptimizedScore,
                baseline: 0.84,
                improved: 0.91,
                unit: "score",
                direction: "higher-is-better"
              },
              {
                _tag: "Comparison",
                key: workflowEvidenceItemKeys.winnerVsAuthoredOptimizedNodeCount,
                label: workflowEvidenceItemLabels.winnerVsAuthoredOptimizedNodeCount,
                baseline: 3,
                improved: 4,
                unit: "count",
                direction: "higher-is-better"
              },
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.trialBudget,
                workflowEvidenceItemLabels.trialBudget,
                "trials",
                4
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.completedTrials,
                workflowEvidenceItemLabels.completedTrials,
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
            key: workflowEvidenceSectionKeys.optimizationWinner,
            title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationWinner),
            items: [
              {
                _tag: "Table",
                key: workflowEvidenceItemKeys.selectedKnobs,
                label: workflowEvidenceItemLabels.selectedKnobs,
                columns: ["Knob", "Choice"],
                rows: [["instruction-profile", "stepwise"], ["critique-pass-budget", "2"]]
              },
              keyedTextItem(
                workflowEvidenceItemLabels.winnerTraversal,
                traversalText(fixture.winnerTraversal),
                workflowEvidenceItemKeys.winnerTraversal
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
          new WorkflowCanonicalStep({
            seedId,
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
            key: workflowVariantOverviewSectionKey("optimized"),
            title: workflowSectionTitle(workflowVariantOverviewSectionKey("optimized")),
            items: [
              {
                _tag: "Table",
                key: workflowEvidenceItemKeys.traversal,
                label: workflowEvidenceItemLabels.traversal,
                columns: ["Node", "Kind", "Role"],
                rows: fixture.winnerTraversal.map((row) => [...row])
              },
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.traversalSteps,
                workflowEvidenceItemLabels.traversalSteps,
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
            key: workflowNodeExecutionSectionKey({
              nodeId: fixture.optimizedReplyNodeId,
              nodeKind: "responder",
              variant: "optimized"
            }),
            title: workflowSectionTitle(
              workflowNodeExecutionSectionKey({
                nodeId: fixture.optimizedReplyNodeId,
                nodeKind: "responder",
                variant: "optimized"
              })
            ),
            items: [
              keyedTextItem(
                workflowEvidenceItemLabels.output,
                fixture.optimizedOutput,
                workflowEvidenceItemKeys.output
              ),
              keyedTextItem(
                workflowEvidenceItemLabels.prompt,
                fixture.optimizedPrompt,
                workflowEvidenceItemKeys.prompt
              ),
              keyedTextItem(
                workflowEvidenceItemLabels.rawResponse,
                fixture.optimizedOutput,
                workflowEvidenceItemKeys.rawResponse
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.traceDuration,
                workflowEvidenceItemLabels.traceDuration,
                "ms",
                164
              ),
              keyedScalarItem(
                "integer",
                workflowEvidenceItemKeys.totalTokens,
                workflowEvidenceItemLabels.totalTokens,
                "tokens",
                188
              )
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
                key: workflowNodeExecutionSectionKey({
                  nodeId: "render-check",
                  nodeKind: "render-evaluator",
                  variant: "optimized"
                }),
                title: workflowSectionTitle(
                  workflowNodeExecutionSectionKey({
                    nodeId: "render-check",
                    nodeKind: "render-evaluator",
                    variant: "optimized"
                  })
                ),
                items: [
                  keyedTextItem(
                    workflowEvidenceItemLabels.output,
                    fixture.optimizedRenderCheckOutput ?? "",
                    workflowEvidenceItemKeys.output
                  ),
                  keyedTextItem(
                    workflowEvidenceItemLabels.prompt,
                    "Evaluate whether the reply fits the narrow-panel surface.",
                    workflowEvidenceItemKeys.prompt
                  ),
                  keyedTextItem(
                    workflowEvidenceItemLabels.rawResponse,
                    fixture.optimizedRenderCheckOutput ?? "",
                    workflowEvidenceItemKeys.rawResponse
                  ),
                  keyedScalarItem(
                    "integer",
                    workflowEvidenceItemKeys.traceDuration,
                    workflowEvidenceItemLabels.traceDuration,
                    "ms",
                    93
                  ),
                  keyedScalarItem(
                    "integer",
                    workflowEvidenceItemKeys.totalTokens,
                    workflowEvidenceItemLabels.totalTokens,
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
            key: workflowEvidenceSectionKeys.workflowDelta,
            title: "Comparison Delta",
            items: [
              {
                _tag: "Comparison",
                key: workflowEvidenceItemKeys.aggregateScore,
                label: "Aggregate Score",
                baseline: 0.62,
                improved: 0.91,
                unit: "score",
                direction: "higher-is-better"
              },
              {
                _tag: "Comparison",
                key: workflowEvidenceItemKeys.graphNodes,
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
    yield* emitEvent(source, encodeEvidenceEventJson(StreamComplete.make({ summary, meta })))
  })
