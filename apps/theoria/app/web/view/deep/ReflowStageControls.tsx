import type { ChangeEvent } from "react"

import type { ReflowWidgetViewModel } from "../../atoms/widget-view-models.js"
import type { ToneClasses } from "../primitives/designSystem.js"

import { ChoicePills } from "../primitives/ChoicePills.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { LoadingIndicator } from "../primitives/Skeleton.js"
import { SliderRow } from "../primitives/SliderRow.js"
import { TextAreaField } from "../primitives/TextAreaField.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

export const ReflowStageControls = ({
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
}) => (
  <Stack className="gap-4">
    {vm.usingCustomText
      ? (
        <Stack className="gap-2">
          <SemanticText as="p" className="text-ink-700" role="row-label" text="Custom text" variant="expanded" />
          <TextAreaField
            active
            disabled={vm.isAnimating}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
              onSetCustomText(event.target.value)
            }}
            placeholder="Paste or type your own text to compare the projected line layout…"
            rows={4}
            tone={tone}
            value={vm.customText}
          />
        </Stack>
      )
      : null}

    <ChoicePills
      activeIndex={vm.selectedCorpusIndex}
      className="w-full gap-2 xl:justify-center"
      disabled={vm.isAnimating}
      onSelect={onSelectCorpus}
      options={vm.corpusOptions}
      tone={tone}
    />

    <Cluster className="w-full items-center justify-between gap-4 xl:flex-nowrap">
      <Layer className="min-w-0 flex-1">
        <SliderRow
          disabled={vm.isAnimating}
          display={vm.width.display}
          label="Width"
          max={vm.width.max}
          min={vm.width.min}
          onChange={onSetWidth}
          step={1}
          tone={tone}
          value={vm.width.value}
        />
      </Layer>
      <Layer className="flex w-full shrink-0 items-center justify-end gap-3 xl:w-auto xl:flex-nowrap">
        <LoadingIndicator active={vm.isAnimating} text="Animating…" tone={tone} />
        <ToggleSwitch
          checked={vm.obstaclesEnabled}
          disabled={vm.isAnimating}
          label="Obstacles"
          onToggle={onToggleObstacles}
          tone={tone}
        />
      </Layer>
    </Cluster>
  </Stack>
)
