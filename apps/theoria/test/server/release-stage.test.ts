import { expect, it } from "@effect/vitest"
import { Config, ConfigProvider, Effect } from "effect"

import { releaseStageConfig } from "../../app/server/config/release-stage.js"

const withEnvironment = (variables: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown(variables))

it.effect("reads RELEASE_STAGE from the configured provider", () =>
  Effect.gen(function*() {
    const stage = yield* releaseStageConfig

    expect(stage).toBe("production")
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "production" }))))

it.effect("treats an unset RELEASE_STAGE as preview, whatever else the environment holds", () =>
  Effect.gen(function*() {
    const stage = yield* releaseStageConfig

    expect(stage).toBe("preview")
  }).pipe(Effect.provide(withEnvironment({ NODE_ENV: "production", DEPLOY_TARGET: "production" }))))

it.effect("rejects an unsupported RELEASE_STAGE instead of silently degrading", () =>
  Effect.gen(function*() {
    const error = yield* Effect.flip(releaseStageConfig)

    expect(error).toBeInstanceOf(Config.ConfigError)
  }).pipe(Effect.provide(withEnvironment({ RELEASE_STAGE: "staging" }))))
