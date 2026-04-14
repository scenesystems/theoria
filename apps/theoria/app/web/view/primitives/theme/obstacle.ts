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

const digestObstacleTone: ObstacleTone = {
  shell: "border-tone-digest-300/60 bg-stage-0/80",
  accent: "bg-tone-digest-500",
  label: "text-tone-digest-900",
  meta: "text-tone-digest-700",
  badge: "border-tone-digest-300/70 bg-stage-0/88 text-tone-digest-800",
  glyphPanel: "rounded-xl border border-stage-0/60 bg-stage-0/74 p-2",
  glyphMuted: "bg-stage-0/72"
}

export const obstacleToneFor = (_tone: CardTone): ObstacleTone => digestObstacleTone
