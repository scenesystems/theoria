import type { FileSystem, Path } from "@effect/platform"
import { Effect, Match, type Stream } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type Card, cards, cardVisibleInReleaseStage } from "../../contracts/card.js"
import type { Id } from "../../contracts/id.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import type { RunData } from "../../contracts/run.js"
import type { StreamManifest } from "../../contracts/stream-manifest.js"

type ProgramSourceEnv = FileSystem.FileSystem | Path.Path

import { preloadProgram as preloadDigestProgram, run as runDigest } from "./digest/run.js"
import type { DspProviderRuntime, DspProviderRuntimeApi } from "./effect-dsp/provider.js"
import {
  preloadProgram as preloadEffectDspProgram,
  run as runEffectDsp,
  streamElements as streamEffectDspElements
} from "./effect-dsp/run.js"
import {
  preloadProgram as preloadEffectMathProgram,
  run as runEffectMath,
  streamElements as streamEffectMathElements
} from "./effect-math/run.js"
import {
  preloadProgram as preloadEffectSearchProgram,
  run as runEffectSearch,
  streamElements as streamEffectSearchElements
} from "./effect-search/run.js"
import {
  preloadProgram as preloadEffectTextProgram,
  run as runEffectText,
  streamElements as streamEffectTextElements
} from "./effect-text/run.js"
import type { Lane } from "./policy.js"
import { preloadProgram as preloadSealProgram, run as runSeal } from "./seal/run.js"
import { preloadProgram as preloadSignProgram, run as runSign } from "./sign/run.js"
import type { StreamElement } from "./stream-element.js"

type Definition = {
  readonly id: Id
  readonly card: Card
  readonly lane: Lane
  readonly execute: Effect.Effect<RunData, unknown, DspProviderRuntime | ProgramSourceEnv>
  readonly preload: Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv>
  readonly streamElements: (
    manifest: StreamManifest | null,
    runtime?: DspProviderRuntimeApi
  ) => Stream.Stream<StreamElement, unknown, never> | null
}

const preloadFrom = (
  card: Card,
  program: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
): Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv> =>
  program.pipe(
    Effect.map((loadedProgram) => ({
      id: card.id,
      card,
      summary: card.summary,
      program: loadedProgram
    }))
  )

const makeDefinition = (
  card: Card,
  lane: Lane,
  execute: Effect.Effect<RunData, unknown, DspProviderRuntime | ProgramSourceEnv>,
  preload: Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv>,
  streamElements: (
    manifest: StreamManifest | null,
    runtime?: DspProviderRuntimeApi
  ) => Stream.Stream<StreamElement, unknown, never> | null = () => null
): Definition => ({
  id: card.id,
  card,
  lane,
  execute,
  preload,
  streamElements
})

const definitionForCard = (card: Card): Option.Option<Definition> =>
  Match.value(card.id).pipe(
    Match.when("effect-text", () =>
      Option.some(makeDefinition(
        card,
        "local",
        runEffectText,
        preloadFrom(card, preloadEffectTextProgram),
        streamEffectTextElements
      ))),
    Match.when("effect-search", () =>
      Option.some(makeDefinition(
        card,
        "local",
        runEffectSearch,
        preloadFrom(card, preloadEffectSearchProgram),
        streamEffectSearchElements
      ))),
    Match.when("effect-math", () =>
      Option.some(makeDefinition(
        card,
        "local",
        runEffectMath,
        preloadFrom(card, preloadEffectMathProgram),
        streamEffectMathElements
      ))),
    Match.when("digest", () =>
      Option.some(makeDefinition(card, "local", runDigest, preloadFrom(card, preloadDigestProgram)))),
    Match.when("sign", () =>
      Option.some(makeDefinition(card, "local", runSign, preloadFrom(card, preloadSignProgram)))),
    Match.when(
      "seal",
      () => Option.some(makeDefinition(card, "local", runSeal, preloadFrom(card, preloadSealProgram)))
    ),
    Match.when("effect-dsp", () =>
      Option.some(makeDefinition(
        card,
        "provider",
        runEffectDsp,
        preloadFrom(card, preloadEffectDspProgram),
        (manifest, runtime) =>
          Option.match(Option.fromNullable(runtime), {
            onNone: () => null,
            onSome: (providerRuntime) => streamEffectDspElements(manifest, providerRuntime)
          })
      ))),
    Match.orElse(() => Option.none())
  )

const definitions: ReadonlyArray<Definition> = Arr.filterMap(cards, definitionForCard)

export const lookup = (id: Id): Option.Option<Definition> =>
  Arr.findFirst(definitions, (definition) => definition.id === id)

export const lookupForReleaseStage = (id: Id, stage: ReleaseStage): Option.Option<Definition> =>
  lookup(id).pipe(
    Option.filter((definition) => cardVisibleInReleaseStage(definition.card, stage))
  )
