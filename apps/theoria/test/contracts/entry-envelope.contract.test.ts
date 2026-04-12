import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { Metadata } from "../../app/contracts/envelope.js"
import {
  ProgramPreviewEnvelope,
  ProgramPreviewSuccessEnvelope
} from "../../app/contracts/presentation/program-preview.js"
import { RunEnvelope, RunSuccessEnvelope } from "../../app/contracts/study/run.js"
import { effectTextCardFixture, programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"

describe("Theoria Entry Envelope Contracts", () => {
  it.effect("decodes run envelope payloads with typed study data", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(RunEnvelope)(
        RunSuccessEnvelope.ok(
          Metadata.make({
            requestId: "req-run",
            buildSha: "build-run",
            durationMs: 5
          }),
          runDataFixture("run contract fixture")
        )
      )

      expect(decoded.ok).toBe(true)
      if (decoded.ok) {
        expect(decoded.data.id).toBe("effect-text")
        expect(decoded.data.sections.length).toBeGreaterThan(0)
      }
    }))

  it.effect("decodes preload envelope payloads with program preview metadata", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(ProgramPreviewEnvelope)(
        ProgramPreviewSuccessEnvelope.ok(
          Metadata.make({
            requestId: "req-preload",
            buildSha: "build-preload",
            durationMs: 1
          }),
          programPreviewFixture
        )
      )

      expect(decoded.ok).toBe(true)
      if (decoded.ok) {
        expect(decoded.data.card.id).toBe(effectTextCardFixture.id)
        expect(decoded.data.card.packageName).toBe(effectTextCardFixture.packageName)
        expect(decoded.data.card.title).toBe(effectTextCardFixture.title)
      }
    }))
})
