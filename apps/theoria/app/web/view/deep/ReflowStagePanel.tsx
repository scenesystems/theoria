import type { ReflowWidgetViewModel } from "../../atoms/widget-view-models.js"
import type { ToneClasses } from "../primitives/designSystem.js"

import { Stack } from "../primitives/Layout.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
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
  readonly tone: ToneClasses
  readonly vm: ReflowWidgetViewModel
}) =>
  vm.stage === null
    ? (
      <Stack className="gap-4 xl:px-4 2xl:px-6">
        <LoadingIndicator active text="Preparing text…" tone={tone} />
        <ContentPlaceholder text="Preparing text…" />
      </Stack>
    )
    : (
      <Stack className="mx-auto w-full max-w-6xl gap-4 xl:px-4 2xl:px-6">
        <ReflowStageControls
          onSelectCorpus={onSelectCorpus}
          onSetCustomText={onSetCustomText}
          onSetWidth={onSetWidth}
          onToggleObstacles={onToggleObstacles}
          tone={tone}
          vm={vm}
        />
        <MetricStrip metrics={vm.metrics} />
        <ReflowPreview vm={vm} />
      </Stack>
    )
