import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { canonicalFrameV1 } from "../../app/contracts/canonical-step.js"
import type { EvidenceSection } from "../../app/contracts/evidence.js"
import { workflowEntryDescriptor } from "../../app/contracts/proving-substrate.js"
import {
  workflowComparisonEvidenceItemKeys,
  workflowComparisonEvidenceSectionKeys,
  workflowComparisonNodeExecutionSectionKey,
  workflowComparisonVariantOverviewSectionKey
} from "../../app/contracts/workflow/comparison-evidence-keys.js"
import { makeWorkflowEntrySelection } from "../../app/contracts/workflow/comparison-run.js"
import { WorkflowComparisonCanonicalStep } from "../../app/contracts/workflow/comparison-step.js"
import { workflowComparisonSurfaceViewModel } from "../../app/web/view/deep/workflow-comparison-surface-model.js"
import { programPreviewFixture } from "../helpers/demo-fixtures.js"
import { runningRunState } from "../helpers/run-state.js"

const sections: ReadonlyArray<EvidenceSection> = [
  {
    key: workflowComparisonVariantOverviewSectionKey("baseline"),
    title: "Baseline Graph",
    items: [{
      _tag: "Table",
      key: workflowComparisonEvidenceItemKeys.traversal,
      label: "Traversal",
      columns: ["Node", "Kind", "Role"],
      rows: [["handoff", "chat-handoff", "teacher"], ["reply", "responder", "task"]]
    }]
  },
  {
    key: workflowComparisonNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "baseline" }),
    title: "Baseline · reply",
    items: [
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.output,
        label: "Output",
        value: "Baseline chat handoff."
      },
      { _tag: "Text", key: workflowComparisonEvidenceItemKeys.prompt, label: "Prompt", value: "Continue the handoff." },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.rawResponse,
        label: "Raw response",
        value: "Baseline chat handoff."
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.traceDuration,
        label: "Trace duration",
        value: 118,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.totalTokens,
        label: "Total tokens",
        value: 146,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
    key: workflowComparisonEvidenceSectionKeys.optimizationStudyProgress,
    title: "Optimization Study Progress",
    items: [
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.trialBudget,
        label: "Trial budget",
        value: 4,
        unit: "trials",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.completedTrials,
        label: "Completed trials",
        value: 2,
        unit: "trials",
        format: "integer"
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.currentSelection,
        label: "Current selection",
        value: "runtime-profile=preferred · surface-profile=sidebar"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.currentScore,
        label: "Current score",
        value: 0.88,
        unit: "score",
        format: "fixed"
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.bestSelection,
        label: "Best selection",
        value: "instruction-profile=stepwise · critique-pass-budget=2"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.bestScore,
        label: "Best score",
        value: 0.91,
        unit: "score",
        format: "fixed"
      }
    ]
  },
  {
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
      }
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
        rows: [["completed count", "2"], ["trial count", "4"]]
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.snapshotJson,
        label: "Snapshot JSON",
        value: "{\"trialCount\":4}"
      }
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
        rows: [["instruction-profile", "stepwise"], ["critique-pass-budget", "2"]]
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.winnerTraversal,
        label: "Winner traversal",
        value: "handoff -> retrieval -> reply -> render-check"
      }
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
        rows: [["1", "TrialStarted", "trial 1 reserved"], ["2", "TrialCompleted", "trial 1 completed"]]
      }
    ]
  },
  {
    key: workflowComparisonNodeExecutionSectionKey({ nodeId: "reply", nodeKind: "responder", variant: "optimized" }),
    title: "Optimized · reply",
    items: [
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.output,
        label: "Output",
        value: "Winner chat handoff reply."
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.prompt,
        label: "Prompt",
        value: "Continue the handoff with retrieval context."
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.rawResponse,
        label: "Raw response",
        value: "Winner chat handoff reply."
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.traceDuration,
        label: "Trace duration",
        value: 164,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.totalTokens,
        label: "Total tokens",
        value: 188,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
    key: workflowComparisonNodeExecutionSectionKey({
      nodeId: "render-check",
      nodeKind: "render-evaluator",
      variant: "optimized"
    }),
    title: "Optimized · render-check",
    items: [
      { _tag: "Text", key: workflowComparisonEvidenceItemKeys.output, label: "Output", value: "Render check output." },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.prompt,
        label: "Prompt",
        value: "Evaluate the render fit."
      },
      {
        _tag: "Text",
        key: workflowComparisonEvidenceItemKeys.rawResponse,
        label: "Raw response",
        value: "Render check output."
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.traceDuration,
        label: "Trace duration",
        value: 81,
        unit: "ms",
        format: "integer"
      },
      {
        _tag: "Scalar",
        key: workflowComparisonEvidenceItemKeys.totalTokens,
        label: "Total tokens",
        value: 42,
        unit: "tokens",
        format: "integer"
      }
    ]
  },
  {
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
]

describe("workflow-comparison surface model", () => {
  it.effect("projects graph, transcript, and rendered-preview view models from canonical frame and evidence truth", () =>
    Effect.gen(function*() {
      const runDraft = Schema.decodeUnknownSync(workflowEntryDescriptor.draftSchema)({
        entryId: "workflow",
        seedId: "chat-handoff",
        input: {},
        controls: makeWorkflowEntrySelection({ seedId: "chat-handoff" }).controls
      })
      const run = runningRunState({
        draft: runDraft,
        program: programPreviewFixture.program
      })

      const model = workflowComparisonSurfaceViewModel({
        draftPlan: makeWorkflowEntrySelection({ seedId: "task-briefing" }),
        frame: canonicalFrameV1(
          new WorkflowComparisonCanonicalStep({
            comparisonId: "chat-handoff",
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
      expect(model.plan.controls.comparisonMode).toBe("search-winner")
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
