import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  canonicalStepEvent,
  Choreography,
  decodeEvidenceEventJson,
  encodeEvidenceEventJson,
  EvidenceEvent,
  SectionAppend,
  SectionUpsert,
  StreamComplete,
  StreamFailed
} from "../../app/contracts/evidence/stream.js"
import { StageEnter } from "../../app/contracts/study/workflow/choreography.js"
import {
  renderSensitiveWorkflowSessionId,
  taskBriefingWorkflowSessionId
} from "../../app/contracts/study/workflow/fixture-manifest.js"
import { WorkflowCanonicalStep } from "../../app/contracts/study/workflow/step.js"

const streamMeta = {
  requestId: "req-stream",
  buildSha: "build-stream",
  durationMs: 12
}

describe("EvidenceEvent Contract", () => {
  it.effect("decodes SectionAppend with a valid evidence section", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "SectionAppend",
        section: {
          title: "Performance",
          items: [
            { _tag: "Scalar", label: "Speedup", value: 2.5, unit: "×" }
          ]
        }
      })

      expect(decoded._tag).toBe("SectionAppend")
    }))

  it.effect("decodes StreamComplete with summary and completion metadata", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "StreamComplete",
        summary: "Benchmark finished.",
        meta: streamMeta
      })

      expect(decoded._tag).toBe("StreamComplete")
      if (decoded._tag === "StreamComplete") {
        expect(decoded.summary).toBe("Benchmark finished.")
        expect(decoded.meta.requestId).toBe("req-stream")
      }
    }))

  it.effect("decodes SectionUpsert with a valid evidence section", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "SectionUpsert",
        section: {
          title: "Streaming Trial Positions",
          items: [{ _tag: "Text", label: "Latest", value: "trial 1" }]
        }
      })

      expect(decoded._tag).toBe("SectionUpsert")
    }))

  it.effect("decodes StreamFailed with a structured error payload", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "StreamFailed",
        error: {
          code: "execution-failed",
          message: "stream failed",
          retryable: true
        }
      })

      expect(decoded._tag).toBe("StreamFailed")
      if (decoded._tag === "StreamFailed") {
        expect(decoded.error.message).toBe("stream failed")
      }
    }))

  it.effect("rejects unknown _tag values", () =>
    Effect.gen(function*() {
      const result = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "UnknownEvent",
        data: 42
      }).pipe(Effect.either)

      expect(result._tag).toBe("Left")
    }))

  it.effect("SectionAppend instances carry section data", () =>
    Effect.gen(function*() {
      const event = new SectionAppend({
        section: {
          title: "Corpus",
          items: [{ _tag: "Text", label: "Size", value: "100" }]
        }
      })

      expect(event._tag).toBe("SectionAppend")
      expect(event.section.title).toBe("Corpus")
    }))

  it.effect("StreamComplete instances carry summary and timing metadata", () =>
    Effect.gen(function*() {
      const event = StreamComplete.make({ summary: "Done.", meta: streamMeta })
      expect(event._tag).toBe("StreamComplete")
      expect(event.summary).toBe("Done.")
      expect(event.meta.durationMs).toBe(12)
    }))

  it.effect("SectionUpsert instances carry section data", () =>
    Effect.gen(function*() {
      const event = new SectionUpsert({
        section: {
          title: "Streaming Corpus",
          items: [{ _tag: "Text", label: "Size", value: "10" }]
        }
      })

      expect(event._tag).toBe("SectionUpsert")
      expect(event.section.title).toBe("Streaming Corpus")
    }))

  it.effect("StreamFailed instances carry structured error metadata", () =>
    Effect.gen(function*() {
      const event = StreamFailed.make({
        error: {
          code: "execution-failed",
          message: "failed",
          retryable: true
        }
      })

      expect(event._tag).toBe("StreamFailed")
      expect(event.error.code).toBe("execution-failed")
    }))

  it.effect("decodes Choreography events with embedded cues", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Choreography",
        cue: {
          _tag: "StageEnter",
          stageId: "corpus-sweep",
          params: { corpusIndex: 0 }
        }
      })

      expect(decoded._tag).toBe("Choreography")
    }))

  it.effect("Choreography instances wrap choreography cues", () =>
    Effect.gen(function*() {
      const event = new Choreography({
        cue: new StageEnter({ stageId: "effect-size", params: { d: 0.5 } })
      })

      expect(event._tag).toBe("Choreography")
      expect(event.cue._tag).toBe("StageEnter")
    }))

  it.effect("decodes workflow canonical steps", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(EvidenceEvent)({
        _tag: "Step",
        frame: {
          version: "v1",
          step: {
            _tag: "WorkflowCanonicalStep",
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
          }
        }
      })

      expect(decoded._tag).toBe("Step")
      if (decoded._tag === "Step") {
        expect(decoded.frame.version).toBe("v1")
        expect(decoded.frame.step._tag).toBe("WorkflowCanonicalStep")
      }
    }))

  it.effect("Step wraps workflow-authored canonical cues", () =>
    Effect.gen(function*() {
      const event = canonicalStepEvent(
        new WorkflowCanonicalStep({
          seedId: taskBriefingWorkflowSessionId,
          workflowKind: "task-first",
          variant: "baseline",
          nodeId: "planner-task",
          nodeKind: "planner",
          runtimeRole: "task",
          stepIndex: 2,
          stepCount: 4,
          lineage: ["planner-task"],
          activeStateLanes: ["conversation"],
          outputText: "Critique the authored plan before refinement.",
          aggregateScore: 0.62
        })
      )

      expect(event._tag).toBe("Step")
      expect(event.frame.version).toBe("v1")
      expect(event.frame.step._tag).toBe("WorkflowCanonicalStep")
    }))

  it.effect("workflow canonical steps round-trip through the shared evidence stream contract", () =>
    Effect.sync(() => {
      const encoded = encodeEvidenceEventJson(
        canonicalStepEvent(
          new WorkflowCanonicalStep({
            seedId: renderSensitiveWorkflowSessionId,
            workflowKind: "render-sensitive",
            variant: "optimized",
            nodeId: "optimization-study",
            nodeKind: "critic",
            runtimeRole: "critic",
            stepIndex: 2,
            stepCount: 3,
            lineage: ["optimization-study"],
            activeStateLanes: ["conversation"],
            outputText: "Optimization found a render-aware improvement.",
            aggregateScore: 0.81
          })
        )
      )
      const decoded = decodeEvidenceEventJson(encoded)

      expect(decoded._tag).toBe("Right")
      if (decoded._tag === "Right") {
        expect(decoded.right._tag).toBe("Step")
        if (decoded.right._tag === "Step") {
          expect(decoded.right.frame.version).toBe("v1")
          expect(decoded.right.frame.step._tag).toBe("WorkflowCanonicalStep")
          if (decoded.right.frame.step._tag === "WorkflowCanonicalStep") {
            expect(decoded.right.frame.step.variant).toBe("optimized")
            expect(decoded.right.frame.step.aggregateScore).toBe(0.81)
          }
        }
      }
    }))
})
