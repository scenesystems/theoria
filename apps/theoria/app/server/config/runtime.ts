import { Clock, Config, Context, Effect, Layer } from "effect"

export class RuntimeInfo extends Context.Tag("@theoria/app/server/config/RuntimeInfo")<
  RuntimeInfo,
  {
    readonly buildSha: string
    readonly startedAtMs: number
  }
>() {}

const nonEmptyOrDefault = (raw: string, fallback: string): string => raw.trim().length > 0 ? raw.trim() : fallback

const makeRuntimeInfo = Effect.gen(function*() {
  const rawBuildSha = yield* Config.string("RAILWAY_GIT_COMMIT_SHA").pipe(
    Config.orElse(() => Config.string("BUILD_SHA")),
    Config.withDefault("dev-local")
  )
  const buildSha = nonEmptyOrDefault(rawBuildSha, "dev-local")
  const startedAtMs = yield* Clock.currentTimeMillis

  return RuntimeInfo.of({
    buildSha,
    startedAtMs
  })
})

export const RuntimeInfoLive = Layer.effect(RuntimeInfo, makeRuntimeInfo)
