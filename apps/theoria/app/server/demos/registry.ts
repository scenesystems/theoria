import type { Stream } from "effect"
import { Effect, Match } from "effect"
import * as Arr from "effect/Array"
import type * as Option from "effect/Option"

import { type Card, cards } from "../../contracts/card.js"
import type { EvidenceSection } from "../../contracts/evidence.js"
import type { Id } from "../../contracts/id.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import type { RunData } from "../../contracts/run.js"

import { preloadProgram as preloadDigestProgram, run as runDigest } from "./digest/run.js"
import type { DspProviderRuntime } from "./effect-dsp/provider.js"
import { preloadProgram as preloadEffectDspProgram, run as runEffectDsp } from "./effect-dsp/run.js"
import {
  preloadProgram as preloadEffectMathProgram,
  run as runEffectMath,
  streamSections as streamEffectMathSections
} from "./effect-math/run.js"
import {
  preloadProgram as preloadEffectSearchProgram,
  run as runEffectSearch,
  streamSections as streamEffectSearchSections
} from "./effect-search/run.js"
import {
  preloadProgram as preloadEffectTextProgram,
  run as runEffectText,
  streamSections as streamEffectTextSections
} from "./effect-text/run.js"
import type { Lane } from "./policy.js"
import { preloadProgram as preloadSealProgram, run as runSeal } from "./seal/run.js"
import { preloadProgram as preloadSignProgram, run as runSign } from "./sign/run.js"

type Definition = {
  readonly id: Id
  readonly card: Card
  readonly lane: Lane
  readonly execute: Effect.Effect<RunData, unknown, DspProviderRuntime>
  readonly preload: Effect.Effect<ProgramPreview, unknown, never>
  readonly streamSections: (customText?: string) => Stream.Stream<EvidenceSection, unknown, never> | null
}

const preloadFrom = (
  card: Card,
  program: Effect.Effect<ProgramPreview["program"], unknown, never>
): Effect.Effect<ProgramPreview, unknown, never> =>
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
  execute: Effect.Effect<RunData, unknown, DspProviderRuntime>,
  preload: Effect.Effect<ProgramPreview, unknown, never>,
  streamSections: (customText?: string) => Stream.Stream<EvidenceSection, unknown, never> | null = () => null
): Definition => ({
  id: card.id,
  card,
  lane,
  execute,
  preload,
  streamSections
})

const definitionForCard = (card: Card): Definition =>
  Match.value(card.id).pipe(
    Match.when("effect-text", () =>
      makeDefinition(card, "local", runEffectText, preloadFrom(card, preloadEffectTextProgram), (customText) =>
        streamEffectTextSections(customText))),
    Match.when("effect-search", () =>
      makeDefinition(card, "local", runEffectSearch, preloadFrom(card, preloadEffectSearchProgram), () =>
        streamEffectSearchSections)),
    Match.when("effect-math", () =>
      makeDefinition(card, "local", runEffectMath, preloadFrom(card, preloadEffectMathProgram), () =>
        streamEffectMathSections)),
    Match.when("digest", () =>
      makeDefinition(card, "local", runDigest, preloadFrom(card, preloadDigestProgram))),
    Match.when("sign", () =>
      makeDefinition(card, "local", runSign, preloadFrom(card, preloadSignProgram))),
    Match.when("seal", () =>
      makeDefinition(card, "local", runSeal, preloadFrom(card, preloadSealProgram))),
    Match.orElse(() =>
      makeDefinition(card, "provider", runEffectDsp, preloadFrom(card, preloadEffectDspProgram))
    )
  )

const definitions: ReadonlyArray<Definition> = Arr.map(cards, definitionForCard)

export const lookup = (id: Id): Option.Option<Definition> =>
  Arr.findFirst(definitions, (definition) => definition.id === id)
