import type { Surface } from "./surface.js"

export type Badge = {
  readonly shell: string
  readonly dot: string
  readonly label?: string
}

export const badgeFromSurface = (surface: Surface): Badge => ({
  shell: surface.badge,
  dot: surface.badgeDot
})

export const neutralBadge: Badge = {
  shell: "border-stage-300/90 bg-stage-0/96 text-ink-800",
  dot: "bg-stage-400",
  label: "text-ink-700"
}
