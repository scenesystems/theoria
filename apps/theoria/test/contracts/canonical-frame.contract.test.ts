import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { EvidenceEvent } from "../../app/contracts/evidence/stream.js"
import { CanonicalFrame, canonicalFrameV1 } from "../../app/contracts/study/workflow/canonical-step.js"
import { taskBriefingWorkflowSessionId } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowCanonicalStep } from "../../app/contracts/study/workflow/step.js"

const workflowCanonicalStep = new WorkflowCanonicalStep({
  seedId: taskBriefingWorkflowSessionId,
  workflowKind: "task-first",
  variant: "baseline",
  nodeId: "planner-task",
  nodeKind: "planner",
  runtimeRole: "task",
  stepIndex: 1,
  stepCount: 4,
  lineage: ["planner-task"],
  activeStateLanes: ["conversation"],
  outputText: "Draft the task-oriented plan before critique.",
  aggregateScore: 0.5
})

describe("CanonicalFrame Contract", () => {
  it.effect("decodes the explicit v1 frame envelope for workflow-authored steps", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(CanonicalFrame)(canonicalFrameV1(workflowCanonicalStep))

      expect(decoded.version).toBe("v1")
      expect(decoded.step._tag).toBe("WorkflowCanonicalStep")
    }))

  it.effect("rejects unknown frame versions at the evidence-stream boundary", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Step",
        frame: {
          version: "v2",
          step: workflowCanonicalStep
        }
      }).pipe(Effect.either)

      expect(result._tag).toBe("Left")
    }))

  it.effect("rejects widget-local frame shapes as canonical transport payloads", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Step",
        frame: {
          version: "v1",
          step: {
            _tag: "effect-text",
            controls: {
              corpusIndex: 0,
              width: 280,
              obstaclesEnabled: false
            }
          }
        }
      }).pipe(Effect.either)

      expect(result._tag).toBe("Left")
    }))
})
