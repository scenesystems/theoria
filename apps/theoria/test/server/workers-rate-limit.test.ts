import { describe, expect, it } from "@effect/vitest"
import { Effect, Logger, type LogLevel, MutableRef, Option, Runtime } from "effect"
import * as Arr from "effect/Array"

import { PlaceBuildLimiter } from "../../app/server/config/place-build-limiter.js"
import { layerFromEnv, windowSeconds } from "../../app/server/platform/workers-rate-limit.js"

type Entry = { readonly level: LogLevel.LogLevel; readonly message: unknown }

/** Collects every log entry so a test can assert what the layer reported. */
const collecting = (seen: MutableRef.MutableRef<ReadonlyArray<Entry>>) =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel, message }) => MutableRef.update(seen, Arr.append({ level: logLevel, message })))
  )

const admit = (actor: string) => PlaceBuildLimiter.pipe(Effect.flatMap((limiter) => limiter.admit(actor)))

describe("server/platform/workers-rate-limit", () => {
  it.effect("maps the binding's answer to an admission and reports the window on refusal", () =>
    Effect.gen(function*() {
      const runtime = yield* Effect.runtime()
      const keys = MutableRef.make<ReadonlyArray<string>>([])
      // Stands in for Cloudflare's Promise-returning binding.
      const binding = {
        limit: ({ key }: { readonly key: string }) => {
          MutableRef.update(keys, Arr.append(key))
          return Runtime.runPromise(runtime)(Effect.succeed({ success: key === "203.0.113.7" }))
        }
      }
      const [admitted, refused] = yield* Effect.all([admit("203.0.113.7"), admit("198.51.100.9")]).pipe(
        Effect.provide(layerFromEnv(Option.some(binding)))
      )
      expect(admitted).toEqual({ _tag: "Admitted" })
      expect(refused).toEqual({ _tag: "Refused", retryAfterSeconds: windowSeconds })
      expect(MutableRef.get(keys)).toEqual(["203.0.113.7", "198.51.100.9"])
    }))

  it.effect("admits every build and logs one warning when the binding is absent from env", () =>
    Effect.gen(function*() {
      const seen = MutableRef.make<ReadonlyArray<Entry>>([])
      const admissions = yield* Effect.all([admit("203.0.113.7"), admit("203.0.113.7")]).pipe(
        Effect.provide(layerFromEnv(Option.none())),
        Effect.provide(collecting(seen))
      )
      expect(admissions).toEqual([{ _tag: "Admitted" }, { _tag: "Admitted" }])
      const warnings = Arr.filter(MutableRef.get(seen), (entry) => entry.level._tag === "Warning")
      expect(warnings.length).toBe(1)
      expect(String(warnings[0]?.message)).toContain("PLACE_BUILD_LIMITER")
    }))
})
