import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import { workflowEntryDescriptor } from "../../app/contracts/entry/descriptors/workflow.js"
import type { EvidenceSection } from "../../app/contracts/evidence/item.js"
import { canonicalFrameV1 } from "../../app/contracts/study/workflow/canonical-step.js"
import {
  workflowEvidenceItemKeys,
  workflowEvidenceItemLabels,
  workflowEvidenceSectionKeys,
  workflowEvidenceSectionTitleForKey,
  workflowNodeExecutionSectionKey,
  workflowVariantOverviewSectionKey
} from "../../app/contracts/study/workflow/evidence.js"
import { defaultWorkflowEntrySelection, WorkflowEntrySelection } from "../../app/contracts/study/workflow/selection.js"
import { WorkflowCanonicalStep } from "../../app/contracts/study/workflow/step.js"
import { WorkflowSurfaceViewModel } from "../../app/web/view/study/workflow/surface-model.js"
import { programPreviewFixture } from "../helpers/entry-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

const workflowSectionTitle = (key: string): string => workflowEvidenceSectionTitleForKey(Option.some(key)) ?? key

const sections: ReadonlyArray<EvidenceSection> = [
  {
    key: workflowVariantOverviewSectionKey("baseline"),
    title: workflowSectionTitle(workflowVariantOverviewSectionKey("baseline")),
    items: [{
      _tag: "Table",
      key: workflowEvidenceItemKeys.traversal,
      label: workflowEvidenceItemLabels.traversal,
      columns: ["Node", "Kind", "Role"],
      rows: [["handoff", "chat-handoff", "teacher"], ["reply", "responder", "task"]]
    }]
  },
  {
    key: workflowNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "baseline" }),
    title: workflowSectionTitle(
      workflowNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "baseline" })
    ),
    items: [
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.output,
        label: workflowEvidenceItemLabels.output,
        value: "Baseline chat handoff."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.prompt,
        label: workflowEvidenceItemLabels.prompt,
        value: "Continue the handoff."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.rawResponse,
        label: workflowEvidenceItemLabels.rawResponse,
        value: "Baseline chat handoff."
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.traceDuration,
        label: workflowEvidenceItemLabels.traceDuration,
        value: 118,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.totalTokens,
        label: workflowEvidenceItemLabels.totalTokens,
        value: 146,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
    key: workflowEvidenceSectionKeys.optimizationStudyProgress,
    title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationStudyProgress),
    items: [
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.trialBudget,
        label: workflowEvidenceItemLabels.trialBudget,
        value: 4,
        unit: "trials",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.completedTrials,
        label: workflowEvidenceItemLabels.completedTrials,
        value: 2,
        unit: "trials",
        format: "integer"
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.currentSelection,
        label: workflowEvidenceItemLabels.currentSelection,
        value: "runtime-profile=preferred · surface-profile=sidebar"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.currentScore,
        label: workflowEvidenceItemLabels.currentScore,
        value: 0.88,
        unit: "score",
        format: "fixed"
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.bestSelection,
        label: workflowEvidenceItemLabels.bestSelection,
        value: "instruction-profile=stepwise · critique-pass-budget=2"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.bestScore,
        label: workflowEvidenceItemLabels.bestScore,
        value: 0.91,
        unit: "score",
        format: "fixed"
      }
    ]
  },
  {
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
      }
    ]
  },
  {
    key: workflowEvidenceSectionKeys.optimizationSnapshot,
    title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationSnapshot),
    items: [
      {
        _tag: "Table",
        key: workflowEvidenceItemKeys.snapshotFacts,
        label: workflowEvidenceItemLabels.snapshotFacts,
        columns: ["Field", "Value"],
        rows: [["completed count", "2"], ["trial count", "4"]]
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.snapshotJson,
        label: workflowEvidenceItemLabels.snapshotJson,
        value: "{\"trialCount\":4}"
      }
    ]
  },
  {
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
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.winnerTraversal,
        label: workflowEvidenceItemLabels.winnerTraversal,
        value: "handoff -> retrieval -> reply -> render-check"
      }
    ]
  },
  {
    key: workflowEvidenceSectionKeys.optimizationStudyEventTrace,
    title: workflowSectionTitle(workflowEvidenceSectionKeys.optimizationStudyEventTrace),
    items: [
      {
        _tag: "Table",
        key: workflowEvidenceItemKeys.studyEvents,
        label: workflowEvidenceItemLabels.studyEvents,
        columns: ["#", "Event", "Detail"],
        rows: [["1", "TrialStarted", "trial 1 reserved"], ["2", "TrialCompleted", "trial 1 completed"]]
      }
    ]
  },
  {
    key: workflowNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "optimized" }),
    title: workflowSectionTitle(
      workflowNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "optimized" })
    ),
    items: [
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.output,
        label: workflowEvidenceItemLabels.output,
        value: "Winner chat handoff reply."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.prompt,
        label: workflowEvidenceItemLabels.prompt,
        value: "Continue the handoff with retrieval context."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.rawResponse,
        label: workflowEvidenceItemLabels.rawResponse,
        value: "Winner chat handoff reply."
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.traceDuration,
        label: workflowEvidenceItemLabels.traceDuration,
        value: 164,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.totalTokens,
        label: workflowEvidenceItemLabels.totalTokens,
        value: 188,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
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
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.output,
        label: workflowEvidenceItemLabels.output,
        value: "Render check output."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.prompt,
        label: workflowEvidenceItemLabels.prompt,
        value: "Evaluate the render fit."
      },
      {
        _tag: "Text",
        key: workflowEvidenceItemKeys.rawResponse,
        label: workflowEvidenceItemLabels.rawResponse,
        value: "Render check output."
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.traceDuration,
        label: workflowEvidenceItemLabels.traceDuration,
        value: 81,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowEvidenceItemKeys.totalTokens,
        label: workflowEvidenceItemLabels.totalTokens,
        value: 42,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
    key: workflowEvidenceSectionKeys.workflowDelta,
    title: workflowSectionTitle(workflowEvidenceSectionKeys.workflowDelta),
    items: [
      {
        _tag: "Comparison",
        key: workflowEvidenceItemKeys.aggregateScore,
        label: workflowEvidenceItemLabels.aggregateScore,
        baseline: 0.62,
        improved: 0.91,
        unit: "score",
        direction: "higher-is-better"
      },
      {
        _tag: "Comparison",
        key: workflowEvidenceItemKeys.graphNodes,
        label: workflowEvidenceItemLabels.graphNodes,
        baseline: 2,
        improved: 4,
        unit: "count",
        direction: "higher-is-better"
      }
    ]
  }
]

describe("workflow surface model", () => {
  it.effect("projects graph, transcript, and rendered-preview view models from canonical frame and evidence truth", () =>
    Effect.gen(function*() {
      const runDraft = Schema.decodeUnknownSync(workflowEntryDescriptor.draftSchema)({
        entryId: "workflow",
        seedId: "chat-handoff",
        input: {},
        controls: WorkflowEntrySelection.make({
          seedId: "chat-handoff",
          controls: defaultWorkflowEntrySelection.controls
        }).controls
      })
      const run = runningRunState({
        draft: runDraft,
        program: programPreviewFixture.program
      })

      const model = WorkflowSurfaceViewModel.project({
        draftPlan: WorkflowEntrySelection.make({
          seedId: "task-briefing",
          controls: defaultWorkflowEntrySelection.controls
        }),
        frame: canonicalFrameV1(
          new WorkflowCanonicalStep({
            scenarioId: "chat-handoff",
            workflowKind: "chat-continuation",
            variant: "optimized",
            nodeId: "render-check",
            nodeKind: "render-evaluator",
            runtimeRole: "evaluator",
            stepIndex: 4,
            stepCount: 4,
            lineage: ["handoff", "retrieval", "reply", "render-check"],
            activeStateLanes: ["conversation", "render"],
            outputText: "Render check output.",
            aggregateScore: 0.91
          })
        ),
        run,
        sections
      })

      expect(model.selection.label).toBe("Chat Handoff")
      expect(model.selectionLocked).toBe(true)
      expect(model.plan.controls.targetMode).toBe("search-winner")
      expect(model.runStory).toBe("baseline -> study -> search winner replay")
      expect(model.graph.cards.map((card) => card.key)).toEqual([
        "baseline",
        "authored-optimized",
        "search-winner"
      ])
      expect(model.graph.cards[0]?.score).toBe("0.620")
      expect(model.graph.cards[1]?.score).toBe("0.840")
      expect(model.graph.cards[2]?.score).toBe("0.910")
      expect(model.graph.currentStep).toContain("Optimized · render-check")
      expect(model.transcript.entries.map((entry) => entry.nodeId)).toEqual(["reply", "reply", "render-check"])
      expect(model.transcript.entries[2]?.isCurrent).toBe(true)
      expect(model.renderedPreview.panes[0]?.body).toContain("Baseline chat handoff")
      expect(model.renderedPreview.panes[1]?.body).toContain("Winner chat handoff reply")
      expect(model.renderedPreview.panes[1]?.body).not.toContain("Render check output")
      expect(model.renderedPreview.metrics[1]?.value).toBe("0.840")
      expect(model.renderedPreview.metrics[4]?.value).toBe("+0.070")
      expect(model.progress.metrics[0]?.value).toBe("4")
      expect(model.progress.selectionRows[2]?.[1]).toContain("runtime-profile=preferred")
      expect(model.progress.snapshotRows[0]?.[0]).toBe("completed count")
      expect(model.progress.eventRows[0]?.[1]).toBe("TrialStarted")
    }))
})
