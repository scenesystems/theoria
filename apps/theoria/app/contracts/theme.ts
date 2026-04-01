import { Match, Option, Schema } from "effect"
import * as HashMap from "effect/HashMap"

import type { PackageGroup } from "./card.js"
import type { Id as CardId } from "./id.js"

export const CardTone = Schema.Literal("text", "search", "math", "dsp", "digest", "sign", "seal")

export type CardTone = typeof CardTone.Type

const entry = (id: string, tone: CardTone): readonly [string, CardTone] => [id, tone]

const toneByCard: HashMap.HashMap<string, CardTone> = HashMap.make(
  entry("effect-text", "text"),
  entry("effect-search", "search"),
  entry("effect-math", "math"),
  entry("effect-dsp", "dsp"),
  entry("digest", "digest"),
  entry("sign", "sign"),
  entry("seal", "seal")
)

const defaultTone: CardTone = "text"

export const toneForCard = (id: CardId): CardTone => Option.getOrElse(HashMap.get(toneByCard, id), () => defaultTone)

export type GroupTheme = {
  readonly dot: string
  readonly accentBorder: string
  readonly versionBg: string
  readonly versionText: string
  readonly ctaText: string
}

export const groupThemeFor = (group: PackageGroup): GroupTheme =>
  Match.value(group).pipe(
    Match.when("effect", () => ({
      dot: "bg-tone-text-500",
      accentBorder: "border-l-tone-text-400",
      versionBg: "bg-tone-text-100",
      versionText: "text-tone-text-800",
      ctaText: "text-tone-text-700 hover:text-tone-text-900"
    })),
    Match.when("scenesystems", () => ({
      dot: "bg-tone-digest-500",
      accentBorder: "border-l-tone-digest-400",
      versionBg: "bg-tone-digest-100",
      versionText: "text-tone-digest-800",
      ctaText: "text-tone-digest-700 hover:text-tone-digest-900"
    })),
    Match.exhaustive
  )
