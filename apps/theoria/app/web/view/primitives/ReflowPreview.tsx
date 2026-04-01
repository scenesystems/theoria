import { useAtomSet } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"
import type { CSSProperties } from "react"

import { makeWidthObserver } from "../../atoms/element-width.js"
import {
  reflowStageFrameBorderPx,
  reflowStageHorizontalInsetPx,
  reflowStageVerticalInsetPx,
  reflowStageViewportWidthAtom
} from "../../atoms/reflow.js"
import type { ReflowWidgetViewModel } from "../../atoms/widget-view-models.js"

import { ArtifactStage } from "./ArtifactStage.js"
import { Layer, Stack } from "./Layout.js"
import { ReflowStageObstacleCard } from "./ReflowStageObstacle.js"
import { SemanticText } from "./SemanticText.js"

const lineSlotClassName = "relative z-10"
const lineRailClassName = "absolute inset-y-0 overflow-hidden"
const lineTextClassName = "block whitespace-nowrap text-ink-900"
const stageContentClassName = "relative min-w-0"

const lineSlotStyle = (lineHeightPx: number): CSSProperties => ({
  height: `${lineHeightPx}px`
})

const lineRailStyle = (leftInsetPx: number, rightInsetPx: number): CSSProperties => ({
  left: `${leftInsetPx}px`,
  right: `${rightInsetPx}px`
})

export const ReflowPreview = ({ vm }: { readonly vm: ReflowWidgetViewModel }) => {
  const setStageViewportWidth = useAtomSet(reflowStageViewportWidthAtom)

  if (vm.stage === null) {
    return null
  }

  const stage = vm.stage
  const observeStageViewport = makeWidthObserver(setStageViewportWidth)
  const frameWidthPx = stage.canvasWidthPx + (reflowStageHorizontalInsetPx * 2) + (reflowStageFrameBorderPx * 2)
  const frameHeightPx = stage.canvasHeightPx + (reflowStageVerticalInsetPx * 2)

  return (
    <ArtifactStage
      bodyStyle={{
        minHeight: `${frameHeightPx}px`,
        paddingBottom: `${reflowStageVerticalInsetPx}px`,
        paddingLeft: `${reflowStageHorizontalInsetPx}px`,
        paddingRight: `${reflowStageHorizontalInsetPx}px`,
        paddingTop: `${reflowStageVerticalInsetPx}px`
      }}
      frameStyle={{ width: `${frameWidthPx}px` }}
      viewportClassName="xl:justify-center"
      viewportRef={observeStageViewport}
    >
      <Layer
        className={stageContentClassName}
        data-reflow-stage="content"
        style={{ minHeight: `${stage.canvasHeightPx}px`, width: `${stage.canvasWidthPx}px` }}
      >
        {Arr.map(stage.obstacles, (obstacle) => <ReflowStageObstacleCard key={obstacle.id} obstacle={obstacle} />)}

        <Stack className="relative min-h-full min-w-0 gap-0">
          {Arr.map(stage.lines, (line) => (
            <Layer
              className={lineSlotClassName}
              data-reflow-line={String(line.index)}
              key={line.index}
              style={lineSlotStyle(stage.lineHeightPx)}
            >
              <Layer
                className={lineRailClassName}
                data-reflow-line-rail={String(line.index)}
                style={lineRailStyle(line.leftInsetPx, line.rightInsetPx)}
              >
                <SemanticText
                  as="span"
                  className={lineTextClassName}
                  role="card-summary"
                  text={line.text.length === 0 ? "\u00a0" : line.text}
                  variant="expanded"
                />
              </Layer>
            </Layer>
          ))}
        </Stack>
      </Layer>
    </ArtifactStage>
  )
}
