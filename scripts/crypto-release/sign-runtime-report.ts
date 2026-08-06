import { Effect, Schema } from "effect"

import { CryptoReleaseCheckError, runCommand } from "./shared.js"

export const SignRuntimeModuleMode = Schema.Literal("esm", "cjs")

const ClassificationCounts = Schema.Struct({
  verified: Schema.NonNegativeInt,
  nonmatch: Schema.NonNegativeInt,
  invalidInput: Schema.NonNegativeInt
})

export const SignRuntimeReportJson = Schema.parseJson(Schema.Struct({
  runtime: Schema.NonEmptyString,
  moduleMode: SignRuntimeModuleMode,
  corpusCases: Schema.Positive,
  classifications: ClassificationCounts,
  timing: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({ p50: Schema.Number, p95: Schema.Number, p99: Schema.Number, max: Schema.Number })
  }),
  peakProcessTreeRssBytes: Schema.Positive,
  hardware: Schema.Struct({
    platform: Schema.NonEmptyString,
    architecture: Schema.NonEmptyString,
    cpuModel: Schema.NonEmptyString,
    logicalCpus: Schema.Positive,
    totalMemoryBytes: Schema.Positive
  }),
  interruption: Schema.Literal("none"),
  boundPlusOne: Schema.Struct({
    ed25519: Schema.Literal("InvalidVerificationInput"),
    p256: Schema.Literal("InvalidVerificationInput"),
    mlDsa65: Schema.Literal("InvalidVerificationInput")
  })
}))

export type SignRuntimeModuleMode = Schema.Schema.Type<typeof SignRuntimeModuleMode>

const failure = (stage: string, detail: string) => new CryptoReleaseCheckError({ stage, detail })

export const runSignRuntimeReport = (
  stage: string,
  cwd: string,
  runtime: string,
  args: ReadonlyArray<string>,
  requestedMode: SignRuntimeModuleMode
) =>
  runCommand(stage, cwd, runtime, args).pipe(
    Effect.flatMap((output) =>
      Schema.decodeUnknown(SignRuntimeReportJson)(output).pipe(
        Effect.mapError(() => failure(stage, "invalid runtime report"))
      )
    ),
    Effect.filterOrFail(
      (report) => report.moduleMode === requestedMode,
      (report) =>
        failure(
          stage,
          `runtime report module mode ${report.moduleMode} did not match requested ${requestedMode}`
        )
    )
  )
