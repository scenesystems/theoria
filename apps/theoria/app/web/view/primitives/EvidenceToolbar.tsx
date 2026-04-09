import { Popover } from "@base-ui-components/react/popover"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/20/solid"
import * as Option from "effect/Option"

import type { EvidencePlaneFilter, EvidencePlaneOrder } from "../../../contracts/evidence/plane.js"
import type { EvidencePlaneLayout } from "../data/evidence-plane-layout.js"
import type { EvidencePlaneViewModel } from "../data/evidence-plane-model.js"

import {
  EvidenceToolbarControlMatrix,
  EvidenceToolbarControlRow,
  evidenceToolbarOptionAt,
  evidenceToolbarOptionValueAt
} from "./EvidenceToolbarControls.js"
import { Layer, Stack } from "./Layout.js"
import { PlaneMetaRail } from "./PlaneMetaRail.js"
import { SemanticText } from "./SemanticText.js"
import { surfaceMaterials } from "./theme/surface.js"

const layoutLabel = (layout: EvidencePlaneLayout): string =>
  layout._tag === "Live" ? "Newest-first stream" : layout._tag === "Focused" ? "Focused section" : "Narrative lanes"

const joinText = (parts: ReadonlyArray<string | null>): string =>
  parts.flatMap((part) => part === null ? [] : [part]).join(" · ")

const triggerClassName = [
  "inline-flex min-h-11 items-center gap-2 rounded-[1rem] border border-stage-200/82 bg-stage-0/82 px-3.5 py-2.5 text-ink-900 transition-colors duration-150 ease-out",
  "hover:border-stage-300 hover:bg-stage-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
  "data-[popup-open]:border-stage-400 data-[popup-open]:bg-stage-50"
].join(" ")

const popupClassName = [
  "w-[min(31rem,calc(100vw-1.25rem))] overflow-hidden rounded-[1.45rem] border border-stage-200/86 bg-stage-0/94",
  "origin-[var(--transform-origin)] shadow-[0_24px_72px_-52px_rgba(15,23,42,0.42)] ring-1 ring-stage-0/68 backdrop-blur-xl",
  "transition-[opacity,transform] duration-150 ease-out data-[closed]:pointer-events-none",
  "data-[starting-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[ending-style]:scale-[0.97]"
].join(" ")

export const EvidenceToolbar = ({
  onSelectFilter,
  onSelectOrder,
  onSelectSection,
  viewModel
}: {
  readonly onSelectFilter: (filter: EvidencePlaneFilter) => void
  readonly onSelectOrder: (order: EvidencePlaneOrder) => void
  readonly onSelectSection: (sectionKey: string | null) => void
  readonly viewModel: EvidencePlaneViewModel
}) => {
  const activeSectionLabel = evidenceToolbarOptionAt(
    viewModel.controls.sectionOptions,
    viewModel.controls.activeSectionIndex
  ).pipe(
    Option.flatMap((option) => option.value === null ? Option.none() : Option.some(option.label))
  )
  const layoutText = layoutLabel(viewModel.layout)
  const focusText = Option.match(activeSectionLabel, {
    onNone: () => null,
    onSome: (label) => `Focus · ${label}`
  })
  const adjustPopover = (
    <Popover.Root>
      <Popover.Trigger className={triggerClassName}>
        <AdjustmentsHorizontalIcon aria-hidden className="h-4 w-4" />
        <SemanticText as="span" role="button-label" text="Adjust" variant="expanded" />
      </Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner
          align="end"
          className="z-[80]"
          collisionPadding={12}
          positionMethod="fixed"
          side="bottom"
          sideOffset={12}
        >
          <Popover.Popup className={popupClassName}>
            <Stack className="max-h-[min(32rem,calc(100dvh-5rem))] gap-4 overflow-y-auto p-4 sm:p-5">
              <PlaneMetaRail
                appearance="panel"
                description="Tune lens, order, and focus for the current evidence plane."
                eyebrow="Evidence controls"
                status={joinText([viewModel.overview.eyebrow, layoutText, focusText])}
              />

              <Stack className={`${surfaceMaterials.evidenceLane} gap-4`}>
                <EvidenceToolbarControlRow
                  activeIndex={viewModel.controls.activeFilterIndex}
                  columns={2}
                  description="Results, raw data, or supporting context."
                  label="Lens"
                  onSelect={(index) => {
                    Option.match(evidenceToolbarOptionValueAt(viewModel.controls.filterOptions, index), {
                      onNone: () => undefined,
                      onSome: onSelectFilter
                    })
                  }}
                  options={viewModel.controls.filterOptions}
                />

                <EvidenceToolbarControlRow
                  activeIndex={viewModel.controls.activeOrderIndex}
                  columns={2}
                  description="Curated narrative ordering or live arrival order."
                  label="View"
                  onSelect={(index) => {
                    Option.match(evidenceToolbarOptionValueAt(viewModel.controls.orderOptions, index), {
                      onNone: () => undefined,
                      onSome: onSelectOrder
                    })
                  }}
                  options={viewModel.controls.orderOptions}
                />

                {viewModel.controls.sectionOptions.length <= 1
                  ? null
                  : (
                    <Stack className="gap-2.5 border-t border-stage-200/62 pt-3.5">
                      <Stack className="gap-1">
                        <SemanticText
                          as="p"
                          className="text-ink-600"
                          role="row-label"
                          text="Focus"
                          variant="expanded"
                        />
                        <SemanticText
                          as="p"
                          className="text-ink-500"
                          role="code-meta"
                          text="Lock to a single section."
                          variant="expanded"
                        />
                      </Stack>
                      <EvidenceToolbarControlMatrix
                        activeIndex={viewModel.controls.activeSectionIndex}
                        columns={2}
                        onSelect={(index) => {
                          Option.match(evidenceToolbarOptionValueAt(viewModel.controls.sectionOptions, index), {
                            onNone: () => undefined,
                            onSome: onSelectSection
                          })
                        }}
                        options={viewModel.controls.sectionOptions}
                        scrollable
                      />
                    </Stack>
                  )}
              </Stack>
            </Stack>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )

  return (
    <Layer className="animate-fade-in-up border-b border-stage-200/70 pb-4">
      <Layer className="px-0 py-0">
        <PlaneMetaRail
          action={adjustPopover}
          description={viewModel.overview.description}
          eyebrow={viewModel.overview.eyebrow}
          metricPresentation="inline"
          metrics={viewModel.overview.metrics}
          {...(focusText === null ? {} : { status: focusText })}
        />
      </Layer>
    </Layer>
  )
}
