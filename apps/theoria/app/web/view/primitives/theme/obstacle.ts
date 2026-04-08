import { Match } from "effect"

import type { CardTone } from "../../../../contracts/tone.js"

export type ObstacleTone = {
  readonly shell: string
  readonly accent: string
  readonly label: string
  readonly meta: string
  readonly badge: string
  readonly glyphPanel: string
  readonly glyphMuted: string
}

export const obstacleToneFor = (tone: CardTone): ObstacleTone =>
  Match.value(tone).pipe(
    Match.when("text", () => ({
      shell: "border-tone-text-300/60 bg-stage-0/80",
      accent: "bg-tone-text-500",
      label: "text-tone-text-900",
      meta: "text-tone-text-700",
      badge: "border-tone-text-300/70 bg-stage-0/88 text-tone-text-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("search", () => ({
      shell: "border-tone-search-300/60 bg-stage-0/80",
      accent: "bg-tone-search-500",
      label: "text-tone-search-900",
      meta: "text-tone-search-700",
      badge: "border-tone-search-300/70 bg-stage-0/88 text-tone-search-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("math", () => ({
      shell: "border-tone-math-300/60 bg-stage-0/80",
      accent: "bg-tone-math-500",
      label: "text-tone-math-900",
      meta: "text-tone-math-700",
      badge: "border-tone-math-300/70 bg-stage-0/88 text-tone-math-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("dsp", () => ({
      shell: "border-tone-dsp-300/60 bg-stage-0/80",
      accent: "bg-tone-dsp-500",
      label: "text-tone-dsp-900",
      meta: "text-tone-dsp-700",
      badge: "border-tone-dsp-300/70 bg-stage-0/88 text-tone-dsp-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("digest", () => ({
      shell: "border-tone-digest-300/60 bg-stage-0/80",
      accent: "bg-tone-digest-500",
      label: "text-tone-digest-900",
      meta: "text-tone-digest-700",
      badge: "border-tone-digest-300/70 bg-stage-0/88 text-tone-digest-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("sign", () => ({
      shell: "border-tone-sign-300/60 bg-stage-0/80",
      accent: "bg-tone-sign-500",
      label: "text-tone-sign-900",
      meta: "text-tone-sign-700",
      badge: "border-tone-sign-300/70 bg-stage-0/88 text-tone-sign-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.when("seal", () => ({
      shell: "border-tone-seal-300/60 bg-stage-0/80",
      accent: "bg-tone-seal-500",
      label: "text-tone-seal-900",
      meta: "text-tone-seal-700",
      badge: "border-tone-seal-300/70 bg-stage-0/88 text-tone-seal-800",
      glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
      glyphMuted: "bg-stage-0/72"
    })),
    Match.exhaustive
  )
