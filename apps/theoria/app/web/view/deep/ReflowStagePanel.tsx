import type { ReflowWidgetViewModel } from "../../atoms/reflow-widget-view-model.js"
import type { Tone } from "../primitives/theme/tone.js"

import { InstrumentPanel } from "../primitives/InstrumentPanel.js"
import { Stack } from "../primitives/Layout.js"
import { ReflowPreview } from "../primitives/ReflowPreview.js"
import { ContentPlaceholder, LoadingIndicator } from "../primitives/Skeleton.js"

import { ReflowStageControls } from "./ReflowStageControls.js"

export const ReflowStagePanel = ({
  onSelectCorpus,
  onSetCustomText,
  onSetWidth,
  onToggleObstacles,
  tone,
  vm
}: {
  readonly onSelectCorpus: (index: number) => void
  readonly onSetCustomText: (text: string) => void
  readonly onSetWidth: (value: number) => void
  readonly onToggleObstacles: () => void
  readonly tone: Tone
  readonly vm: ReflowWidgetViewModel
}) =>
  vm.stage === null
    ? (
      <Stack className="gap-4">
        <LoadingIndicator active={vm.isAnimating} text={vm.statusText ?? "Preparing text…"} tone={tone} />
        <ContentPlaceholder text={vm.statusText ?? "Preparing text…"} />
      </Stack>
    )
    : (
      <Stack className="gap-4">
        <InstrumentPanel
          controls={
            <ReflowStageControls
              onSelectCorpus={onSelectCorpus}
              onSetCustomText={onSetCustomText}
              onSetWidth={onSetWidth}
              onToggleObstacles={onToggleObstacles}
              tone={tone}
              vm={vm}
            />
          }
          metrics={vm.metrics}
        >
          <ReflowPreview vm={vm} />
        </InstrumentPanel>
      </Stack>
    )
