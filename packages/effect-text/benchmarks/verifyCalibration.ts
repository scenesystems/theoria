import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"

import { CalibrationVerificationArtifactJson, computeVerificationArtifact, verifyBenchmarkGate } from "./calibrationVerificationShared.js"

const artifactUrl = new URL("./results/calibration-verification.json", import.meta.url)

const program = Effect.gen(function*() {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const artifactPath = yield* path.fromFileUrl(artifactUrl).pipe(Effect.orDie)
  const writeMode = Bun.argv.includes("--write")
  const computed = yield* computeVerificationArtifact
  const encodedComputed = yield* Schema.encode(CalibrationVerificationArtifactJson)(computed)

  yield* Effect.when(
    fileSystem.makeDirectory(path.dirname(artifactPath), { recursive: true }).pipe(Effect.orDie),
    () => writeMode
  )
  yield* Effect.if(writeMode, {
    onTrue: () =>
      fileSystem.writeFileString(artifactPath, `${encodedComputed}\n`).pipe(
        Effect.orDie,
        Effect.zipRight(Effect.log(`Wrote calibration verification artifact: ${artifactPath}`))
      ),
    onFalse: () =>
      fileSystem.readFileString(artifactPath).pipe(
        Effect.orDie,
        Effect.flatMap((existingText) => Schema.decode(CalibrationVerificationArtifactJson)(existingText)),
        Effect.flatMap((existingArtifact) =>
          Schema.encode(CalibrationVerificationArtifactJson)(existingArtifact).pipe(
            Effect.flatMap((encodedExisting) =>
              Effect.when(
                Effect.dieMessage(
                  "effect-text calibration verification artifact drifted; run `bun run --filter 'effect-text' verify:calibration --write` to refresh it"
                ),
                () => encodedExisting !== encodedComputed
              )
            ),
            Effect.zipRight(
              verifyBenchmarkGate(
                existingArtifact.scoringBenchmark.expectations,
                existingArtifact.scoringBenchmark.maxSlowdownRatio
              )
            ),
            Effect.zipRight(Effect.log(`Verified calibration verification artifact: ${artifactPath}`))
          )
        )
      )
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
