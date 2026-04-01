import { Clock, Config, Context, Effect, Layer } from "effect"

export class RuntimeInfo extends Context.Tag("@theoria/app/server/config/RuntimeInfo")<
  RuntimeInfo,
  {
    readonly buildSha: string
    readonly startedAtMs: number
  }
>() {}

const makeRuntimeInfo = Effect.gen(function*() {
  const buildSha = yield* Config.withDefault(Config.string("BUILD_SHA"), "dev-local")
  const startedAtMs = yield* Clock.currentTimeMillis

  return RuntimeInfo.of({
    buildSha,
    startedAtMs
  })
})

export const RuntimeInfoLive = Layer.effect(RuntimeInfo, makeRuntimeInfo)
