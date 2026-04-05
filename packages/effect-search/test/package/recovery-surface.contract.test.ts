import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Order, Record, Schema } from "effect"
import * as Arr from "effect/Array"

import packageJson from "../../package.json" with { type: "json" }
import * as Study from "../../src/Study/index.js"
import * as StudyEvent from "../../src/StudyEvent/index.js"

const packageRootUrl = new URL("../../", import.meta.url)

const PackageExportsSchema = Schema.Struct({
  exports: Schema.Record({ key: Schema.String, value: Schema.Unknown })
})

const packageExports = Schema.decodeUnknownSync(PackageExportsSchema)(packageJson).exports

describe("package/recovery-surface", () => {
  it("ships the public study recovery surface and keeps internal subpaths blocked", () => {
    expect(Arr.sort(Record.keys(Study), Order.string)).toContain("StudySnapshot")
    expect(Arr.sort(Record.keys(Study), Order.string)).toContain("resumeFromStorage")
    expect(Arr.sort(Record.keys(StudyEvent), Order.string)).toContain("TrialStarted")
    expect(packageExports["./Study"]).toBe("./src/Study/index.ts")
    expect(packageExports["./StudyEvent"]).toBe("./src/StudyEvent/index.ts")
    expect(packageExports["./internal/*"]).toBeNull()

    const diagnosticEvent = StudyEvent.TrialStarted({
      trialNumber: 0,
      config: {},
      diagnostics: {
        samplerKind: "Tpe",
        preparedStateKind: "effect-search/tpe/model-context",
        reusedPreparedState: true,
        completedCount: 1,
        pendingCount: 1,
        imputedCompletedCount: 1,
        belowCount: 1,
        aboveCount: 0
      }
    })

    expect(StudyEvent.isStudyEvent(diagnosticEvent)).toBe(true)
  })

  it.effect("documents resume, storage recovery, and snapshot authority on the shipped surface", () =>
    Effect.gen(function*() {
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* path.fromFileUrl(packageRootUrl).pipe(Effect.orDie)
      const readme = yield* fileSystem.readFileString(path.join(root, "README.md")).pipe(Effect.orDie)

      expect(readme).toContain("Study.resume")
      expect(readme).toContain("Study.resumeFromStorage")
      expect(readme).toContain("StudySnapshot")
      expect(readme).toContain("StudyEvent")
      expect(readme).toContain("TrialStarted")
      expect(readme).toContain("pendingCount")
    }).pipe(Effect.provide(BunContext.layer)))
})
