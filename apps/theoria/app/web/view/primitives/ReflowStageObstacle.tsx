import { Match } from "effect"
import * as Arr from "effect/Array"
import type { CSSProperties } from "react"

import type { ObstacleVariant } from "../../../contracts/obstacle.js"
import type { ReflowStageObstacle } from "../../text/obstacleProjection.js"

import { type ObstacleTone, obstacleToneFor } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

// ---------------------------------------------------------------------------
// Density — drives all internal layout decisions for the obstacle card.
// ---------------------------------------------------------------------------

type ObstacleDensity = "compact" | "standard"

const densityFor = (obstacle: ReflowStageObstacle): ObstacleDensity =>
  obstacle.widthPx <= 140 || obstacle.heightPx <= 100 ? "compact" : "standard"

const canShowDetail = (obstacle: ReflowStageObstacle, density: ObstacleDensity): boolean =>
  density === "compact"
    ? obstacle.heightPx >= 140
    : obstacle.heightPx >= 120

const canShowGlyph = (obstacle: ReflowStageObstacle, density: ObstacleDensity): boolean =>
  density === "standard" && obstacle.widthPx >= 150 && obstacle.heightPx >= 120

// ---------------------------------------------------------------------------
// Shell — absolutely positioned card container.
// ---------------------------------------------------------------------------

const shellClassName = "absolute z-20 overflow-hidden rounded-2xl border shadow-chip backdrop-blur-sm"

const obstacleStyle = (obstacle: ReflowStageObstacle): CSSProperties => ({
  height: `${obstacle.heightPx}px`,
  left: obstacle.placement === "left" ? "0px" : undefined,
  right: obstacle.placement === "right" ? "0px" : undefined,
  top: `${obstacle.topPx}px`,
  width: `${obstacle.widthPx}px`
})

// ---------------------------------------------------------------------------
// Badge — pill-shaped tag at the top of each card.
// ---------------------------------------------------------------------------

const badgeClassName = "w-fit rounded-full border px-2 py-0.5"

// ---------------------------------------------------------------------------
// Glyph — decorative miniature chart driven by obstacle variant.
// ---------------------------------------------------------------------------

const glyphFor = (variant: ObstacleVariant, tone: ObstacleTone) =>
  Match.value(variant).pipe(
    Match.when("figure", () => (
      <Cluster className={`${tone.glyphPanel} items-end gap-1`}>
        {Arr.map([
          { className: `h-3.5 w-2 rounded-sm ${tone.glyphMuted}` },
          { className: `h-6 w-2 rounded-sm ${tone.accent}` },
          { className: `h-4.5 w-2 rounded-sm ${tone.glyphMuted}` }
        ], (bar, index) => <Layer className={bar.className} key={index} />)}
      </Cluster>
    )),
    Match.when("stack", () => (
      <Stack className={`${tone.glyphPanel} gap-1`}>
        {Arr.map([
          `${tone.accent} w-8`,
          `${tone.glyphMuted} w-10`,
          `${tone.glyphMuted} w-7`
        ], (line, index) => <Layer className={`h-1 rounded-full ${line}`} key={index} />)}
      </Stack>
    )),
    Match.when("code", () => (
      <Stack className={`${tone.glyphPanel} gap-1`}>
        {Arr.map([
          `${tone.accent} w-10`,
          `${tone.glyphMuted} w-8`,
          `${tone.glyphMuted} w-6`
        ], (line, index) => <Layer className={`h-1 rounded-full ${line}`} key={index} />)}
      </Stack>
    )),
    Match.when("quote", () => (
      <Stack className={`${tone.glyphPanel} gap-1`}>
        <Layer className={`h-1.5 w-5 rounded-full ${tone.accent}`} />
        <Layer className={`h-1 w-10 rounded-full ${tone.glyphMuted}`} />
        <Layer className={`h-1 w-8 rounded-full ${tone.glyphMuted}`} />
      </Stack>
    )),
    Match.when("panel", () => (
      <Stack className={`${tone.glyphPanel} gap-1`}>
        <Layer className={`h-1.5 w-8 rounded-full ${tone.accent}`} />
        <Layer className={`h-1 w-6 rounded-full ${tone.glyphMuted}`} />
      </Stack>
    )),
    Match.exhaustive
  )

// ---------------------------------------------------------------------------
// Accent strip — bottom bar + optional dot indicator.
// ---------------------------------------------------------------------------

const AccentStrip = ({
  showDot,
  tone
}: {
  readonly showDot: boolean
  readonly tone: ObstacleTone
}) => (
  <Cluster className="items-center gap-1">
    <Layer className={`h-0.5 flex-1 rounded-full ${tone.accent}`} />
    {showDot ? <Layer className={`size-1 shrink-0 rounded-full ${tone.accent}`} /> : null}
  </Cluster>
)

// ---------------------------------------------------------------------------
// ReflowStageObstacleCard — the composed primitive.
// ---------------------------------------------------------------------------

export const ReflowStageObstacleCard = ({ obstacle }: { readonly obstacle: ReflowStageObstacle }) => {
  const density = densityFor(obstacle)
  const tone = obstacleToneFor(obstacle.tone)
  const hasGlyph = canShowGlyph(obstacle, density)
  const hasDetail = canShowDetail(obstacle, density)
  const padding = density === "compact" ? "p-2.5" : "p-3"

  return (
    <Layer
      className={`${shellClassName} ${tone.shell}`}
      data-reflow-obstacle={obstacle.id}
      style={obstacleStyle(obstacle)}
    >
      <Stack className={`h-full justify-between ${padding} gap-2`}>
        <Cluster className="min-w-0 items-start justify-between gap-2">
          <Stack className="min-w-0 gap-1">
            <SemanticText
              as="span"
              className={`${badgeClassName} ${tone.badge}`}
              role="button-label"
              text={obstacle.badge}
              variant="expanded"
            />
            <SemanticText
              as="p"
              className={tone.label}
              role={density === "compact" ? "status" : "row-value"}
              text={obstacle.label}
              variant="expanded"
            />
            {hasDetail
              ? (
                <SemanticText
                  as="p"
                  className={tone.meta}
                  role="code-meta"
                  text={obstacle.detail}
                  variant="expanded"
                />
              )
              : null}
          </Stack>
          {hasGlyph ? glyphFor(obstacle.variant, tone) : null}
        </Cluster>
        <AccentStrip showDot={!hasGlyph} tone={tone} />
      </Stack>
    </Layer>
  )
}
