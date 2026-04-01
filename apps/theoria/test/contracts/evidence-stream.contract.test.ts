import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import {
  EvidenceEvent,
  SectionAppend,
  SectionUpsert,
  StreamComplete,
  StreamFailed
} from "../../app/contracts/evidence-stream.js"

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
      const event = new StreamComplete({ summary: "Done.", meta: streamMeta })
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
      const event = new StreamFailed({
        error: {
          code: "execution-failed",
          message: "failed",
          retryable: true
        }
      })

      expect(event._tag).toBe("StreamFailed")
      expect(event.error.code).toBe("execution-failed")
    }))
})
