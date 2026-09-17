import { Boolean as Bool, Clock, Config, Context, Effect, Layer } from "effect"
import * as Str from "effect/String"

export class RuntimeInfo extends Context.Tag("@theoria/app/server/config/RuntimeInfo")<
  RuntimeInfo,
  {
    readonly buildSha: string
    readonly startedAtMs: number
  }
>() {}

const nonEmptyOrDefault = (raw: string, fallback: string): string => {
  const value = Str.trim(raw)
  return Bool.match(Str.isNonEmpty(value), { onTrue: () => value, onFalse: () => fallback })
}

/** `BUILD_SHA` is set by the deployment workflow (`wrangler deploy --var`). */
const makeRuntimeInfo = Effect.gen(function*() {
  const rawBuildSha = yield* Config.string("BUILD_SHA").pipe(Config.withDefault("dev-local"))
  const buildSha = nonEmptyOrDefault(rawBuildSha, "dev-local")
  const startedAtMs = yield* Clock.currentTimeMillis

  return RuntimeInfo.of({
    buildSha,
    startedAtMs
  })
})

export const RuntimeInfoLive = Layer.effect(RuntimeInfo, makeRuntimeInfo)
