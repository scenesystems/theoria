import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { ProgramPreviewEnvelope } from "../../app/contracts/program-preview.js"
import { RunEnvelope } from "../../app/contracts/run.js"
import { effectTextCardFixture, programPreviewFixture, runDataFixture } from "../helpers/demo-fixtures.js"

describe("Theoria Demo Contracts", () => {
  it.effect("decodes run envelope payloads with typed demo data", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(RunEnvelope)({
        ok: true,
        meta: {
          requestId: "req-run",
          buildSha: "build-run",
          durationMs: 5
        },
        data: runDataFixture("run contract fixture")
      })

      expect(decoded.ok).toBe(true)
      if (decoded.ok) {
        expect(decoded.data.id).toBe("effect-text")
        expect(decoded.data.sections.length).toBeGreaterThan(0)
      }
    }))

  it.effect("decodes preload envelope payloads with program preview metadata", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(ProgramPreviewEnvelope)({
        ok: true,
        meta: {
          requestId: "req-preload",
          buildSha: "build-preload",
          durationMs: 1
        },
        data: programPreviewFixture
      })

      expect(decoded.ok).toBe(true)
      if (decoded.ok) {
        expect(decoded.data.card.id).toBe(effectTextCardFixture.id)
        expect(decoded.data.card.packageName).toBe(effectTextCardFixture.packageName)
        expect(decoded.data.card.title).toBe(effectTextCardFixture.title)
      }
    }))
})
