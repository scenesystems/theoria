import type { Obstacle, ReflowScene } from "../obstacle.js"

const obstacle = (definition: Obstacle): Obstacle => definition

export const customTextScene: ReflowScene = {
  summary:
    "Custom text uses a neutral annotation layout so the browser still demonstrates fixed-plane wrapping without pretending to know your domain.",
  obstacles: [
    obstacle({
      badge: "NOTE",
      detail: "Your text stays primary",
      id: "custom-inline-note",
      label: "Inline note",
      heightPx: 86,
      tone: "text",
      topPx: 24,
      placement: "right",
      variant: "panel",
      widthPx: 150
    }),
    obstacle({
      badge: "TRACE",
      detail: "Projection remains pure",
      id: "custom-reference-panel",
      label: "Reference panel",
      heightPx: 114,
      tone: "search",
      topPx: 128,
      placement: "left",
      variant: "figure",
      widthPx: 124
    }),
    obstacle({
      badge: "STACK",
      detail: "Meaning still comes later",
      id: "custom-evidence-stack",
      label: "Evidence stack",
      heightPx: 96,
      tone: "digest",
      topPx: 264,
      placement: "right",
      variant: "stack",
      widthPx: 154
    })
  ]
}
