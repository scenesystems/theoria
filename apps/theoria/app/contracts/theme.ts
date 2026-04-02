import { Option, Schema } from "effect"
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

/**
 * The brand tone for a package group — all cards within a group share this
 * color family on the home page. Per-card tones (`toneForCard`) are used as
 * the primary accent on deep dive pages.
 *
 * @since 0.1.0
 */
export const representativeToneFor = (group: PackageGroup): CardTone => {
  const tones: Record<PackageGroup, CardTone> = { effect: "text", scenesystems: "digest" }
  return tones[group]
}
