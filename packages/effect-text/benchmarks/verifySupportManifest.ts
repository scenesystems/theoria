import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import { Browser, Text } from "../src/index.js"
import { EffectTextSupportManifest, EffectTextSupportManifestSchema } from "../src/contracts/supportManifest.js"
import { benchmarkIterations } from "./corpus.js"

const encodeJson = <A, I>(schema: Schema.Schema<A, I>) => (value: A) =>
  Schema.encode(Schema.parseJson(schema))(value).pipe(Effect.orDie)

const failWhen = (condition: boolean, message: string) =>
  Effect.when(Effect.dieMessage(message), () => condition)

const program = Effect.gen(function*() {
  const manifest = yield* Schema.decodeUnknown(EffectTextSupportManifestSchema)(EffectTextSupportManifest).pipe(Effect.orDie)
  const encodedBrowserManifest = yield* encodeJson(Browser.BrowserSupportManifestSchema)(Browser.BrowserSupportManifest)
  const encodedManifestBrowser = yield* encodeJson(Browser.BrowserSupportManifestSchema)(manifest.browser)
  const encodedManifestHyphenation = yield* encodeJson(
    Schema.Struct({
      localeFallback: Schema.Literal("exact-or-base-language"),
      locales: Schema.Array(Schema.String).pipe(Schema.minItems(1))
    })
  )(manifest.hyphenation)
  const encodedHyphenationSupport = yield* encodeJson(
    Schema.Struct({
      localeFallback: Schema.Literal("exact-or-base-language"),
      locales: Schema.Array(Schema.String).pipe(Schema.minItems(1))
    })
  )(Text.HyphenationSupport)
  const profileIds = Arr.map(manifest.browser.profiles, (profile) => profile.id)

  yield* failWhen(
    encodedBrowserManifest !== encodedManifestBrowser,
    "effect-text browser manifest drifted away from the checked-in package support manifest"
  )
  yield* failWhen(
    encodedManifestHyphenation !== encodedHyphenationSupport,
    "effect-text hyphenation support drifted away from the checked-in package support manifest"
  )
  yield* failWhen(
    !Arr.contains(profileIds, "canvas-monospace") || !Arr.contains(profileIds, "canvas-system-ui"),
    "effect-text support manifest must ship both canvas-monospace and canvas-system-ui profiles"
  )
  yield* failWhen(
    manifest.benchmarks.walkerKernel.iterations !== benchmarkIterations,
    "effect-text benchmark iterations must be sourced from the checked-in package support manifest"
  )
  yield* failWhen(
    manifest.stability.Experimental !== "unstable",
    "effect-text support manifest must mark the Experimental lane as unstable"
  )
  yield* Effect.log("Verified effect-text support manifest", {
    benchmarkIterations,
    browserProfiles: profileIds,
    calibrationMaxSlowdownRatio: manifest.benchmarks.calibrationScoring.maxSlowdownRatio,
    hyphenationLocales: manifest.hyphenation.locales,
    mirroredPairCount: manifest.bidi.mirroredPairs.length,
    overflowBreakPrecedence: manifest.overflow.breakPrecedence
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
