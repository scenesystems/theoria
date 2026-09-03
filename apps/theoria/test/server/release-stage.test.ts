import { expect, it } from "@effect/vitest"
import { ConfigError, ConfigProvider, Effect, Layer } from "effect"

import { releaseStageConfig, serverReleaseStage } from "../../app/server/config/release-stage.js"

const withEnvironment = (variables: Record<string, string>) =>
  Layer.setConfigProvider(ConfigProvider.fromJson(variables))

it.effect("reads RELEASE_STAGE from the configured provider", () =>
  Effect.gen(function*() {
    const stage = yield* serverReleaseStage

    expect(stage).toBe("production")
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "production" }))))

it.effect("treats an unset RELEASE_STAGE as preview, whatever else the environment holds", () =>
  Effect.gen(function*() {
    const stage = yield* serverReleaseStage

    expect(stage).toBe("preview")
  }).pipe(Effect.provide(withEnvironment({ NODE_ENV: "production", DEPLOY_TARGET: "production" }))))

it.effect("rejects an unsupported RELEASE_STAGE instead of silently degrading", () =>
  Effect.gen(function*() {
    const error = yield* Effect.flip(releaseStageConfig)

    expect(ConfigError.isInvalidData(error)).toBe(true)
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "staging" }))))
