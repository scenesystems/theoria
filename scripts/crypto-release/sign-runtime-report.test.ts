import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { runSignRuntimeReport, type SignRuntimeModuleMode, SignRuntimeReportJson } from "./sign-runtime-report.js"

const CHILD_DIAGNOSTIC = `packed runtime exploded:${"x".repeat(2_100)}`
const MODULE_MODES: ReadonlyArray<SignRuntimeModuleMode> = ["esm", "cjs"]
const stage = (runtime: string, mode: SignRuntimeModuleMode) => `sign-packed-${runtime}-${mode}`
const runChild = (runtime: string, mode: SignRuntimeModuleMode, source: string) =>
  runSignRuntimeReport(stage(runtime, mode), process.cwd(), runtime, ["-e", source], mode).pipe(
    Effect.provide(BunContext.layer)
  )
const writeStdout = (output: string) =>
  `process.stdout.write(${Schema.encodeSync(Schema.parseJson(Schema.String))(output)})`
const writeStderrAndFail = (output: string) =>
  `process.stderr.write(${Schema.encodeSync(Schema.parseJson(Schema.String))(output)});process.exit(7)`
const validReport = (moduleMode: SignRuntimeModuleMode) =>
  Schema.encodeSync(SignRuntimeReportJson)({
    runtime: "test",
    moduleMode,
    corpusCases: 1,
    classifications: { verified: 1, nonmatch: 0, invalidInput: 0 },
    timing: { ed25519: { p50: 1, p95: 1, p99: 1, max: 1 } },
    peakProcessTreeRssBytes: 1,
    hardware: {
      platform: "test",
      architecture: "x64",
      cpuModel: "test",
      logicalCpus: 1,
      totalMemoryBytes: 1
    },
    interruption: "none",
    boundPlusOne: {
      ed25519: "InvalidVerificationInput",
      p256: "InvalidVerificationInput",
      mlDsa65: "InvalidVerificationInput"
    }
  })

describe("Sign packed runtime report qualification", () => {
  it.effect("preserves a nonzero child process diagnostic", () =>
    Effect.gen(function*() {
      const error = yield* runChild(
        "node",
        "cjs",
        writeStderrAndFail(CHILD_DIAGNOSTIC)
      ).pipe(Effect.flip)

      expect(error).toMatchObject({
        _tag: "CryptoReleaseCheckError",
        stage: "sign-packed-node-cjs",
        detail: CHILD_DIAGNOSTIC.slice(0, 2_000)
      })
    }))

  it.effect("classifies successful malformed stdout as an invalid runtime report", () =>
    Effect.gen(function*() {
      const error = yield* runChild("bun", "esm", writeStdout("not-json")).pipe(Effect.flip)

      expect(error).toMatchObject({
        _tag: "CryptoReleaseCheckError",
        stage: "sign-packed-bun-esm",
        detail: "invalid runtime report"
      })
    }))

  it.effect("rejects a schema-valid report for a different module mode", () =>
    Effect.gen(function*() {
      const error = yield* runChild("bun", "esm", writeStdout(validReport("cjs"))).pipe(Effect.flip)

      expect(error).toMatchObject({
        _tag: "CryptoReleaseCheckError",
        stage: "sign-packed-bun-esm",
        detail: "runtime report module mode cjs did not match requested esm"
      })
    }))

  it.effect.each(MODULE_MODES)("admits a matching %s report", (mode) =>
    Effect.gen(function*() {
      const report = yield* runChild("bun", mode, writeStdout(validReport(mode)))

      expect(report.moduleMode).toBe(mode)
    }))
})
