import { expect, it } from "@effect/vitest"
import { ConfigError, ConfigProvider, Effect, Layer, Option } from "effect"

import { releaseStageFromEnvironment } from "../../app/contracts/release-stage.js"
import { releaseStageConfig, serverReleaseStage } from "../../app/server/config/release-stage.js"

const withEnvironment = (variables: Record<string, string>) =>
  Layer.setConfigProvider(ConfigProvider.fromJson(variables))

it("RELEASE_STAGE is authoritative over Railway and NODE_ENV signals", () => {
  expect(releaseStageFromEnvironment({
    releaseStage: Option.some("preview"),
    railwayEnvironmentName: Option.some("production"),
    nodeEnv: Option.some("production")
  })).toBe("preview")
  expect(releaseStageFromEnvironment({
    releaseStage: Option.some("production"),
    railwayEnvironmentName: Option.none(),
    nodeEnv: Option.none()
  })).toBe("production")
})

it("falls back to the Railway environment name, then NODE_ENV, then preview", () => {
  expect(releaseStageFromEnvironment({
    releaseStage: Option.none(),
    railwayEnvironmentName: Option.some(" Production "),
    nodeEnv: Option.none()
  })).toBe("production")
  expect(releaseStageFromEnvironment({
    releaseStage: Option.none(),
    railwayEnvironmentName: Option.some("staging"),
    nodeEnv: Option.some("production")
  })).toBe("production")
  expect(releaseStageFromEnvironment({
    releaseStage: Option.none(),
    railwayEnvironmentName: Option.none(),
    nodeEnv: Option.some("development")
  })).toBe("preview")
})

it.effect("reads RELEASE_STAGE from the configured provider", () =>
  Effect.gen(function*() {
    const stage = yield* serverReleaseStage

    expect(stage).toBe("production")
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "production", NODE_ENV: "test" }))))

it.effect("defaults to preview when nothing is configured", () =>
  Effect.gen(function*() {
    const stage = yield* serverReleaseStage

    expect(stage).toBe("preview")
  }).pipe(Effect.provide(withEnvironment({}))))

it.effect("rejects an unsupported RELEASE_STAGE instead of silently degrading", () =>
  Effect.gen(function*() {
    const error = yield* Effect.flip(releaseStageConfig)

    expect(ConfigError.isInvalidData(error)).toBe(true)
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "staging" }))))
