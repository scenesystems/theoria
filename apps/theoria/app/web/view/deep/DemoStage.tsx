import { ArrowPathIcon, PauseIcon, PlayIcon, StopIcon } from "@heroicons/react/20/solid"
import { Match, Option } from "effect"
import type { ReactNode } from "react"

import type { RunControlActionKind } from "../../state/types.js"
import type { RunControlsViewModel } from "../runControlsModel.js"
import type { DemoEvidenceViewModel, DemoStageViewModel } from "./stageModel.js"

import { ActionButton } from "../primitives/ActionButton.js"
import { Cluster, Layer, Stack } from "../primitives/Layout.js"
import { EmptyState, FailureState, RunningState } from "../primitives/Skeleton.js"
import { StageBanner } from "../primitives/StageBanner.js"

import { EvidenceSections } from "./EvidenceSections.js"

const stagePaneClassName = (active: boolean): string => active ? "min-h-0 flex-1" : "hidden min-h-0 flex-1"

const evidenceSectionsNode = ({
  actions,
  banner,
  includeAction,
  sections
}: {
  readonly actions: ReactNode | undefined
  readonly banner: DemoEvidenceViewModel["banner"]
  readonly includeAction: boolean
  readonly sections: DemoEvidenceViewModel["sections"]
}) => (
  <Stack className="gap-3 animate-fade-in-up">
    {banner === null
      ? null
      : <StageBanner action={includeAction ? actions : undefined} text={banner.text} tone={banner.tone} />}
    <EvidenceSections sections={sections} />
  </Stack>
)

const retainedEvidenceNode = ({
  actions,
  banner,
  emptyNode,
  includeAction,
  sections
}: {
  readonly actions: ReactNode | undefined
  readonly banner: DemoEvidenceViewModel["banner"]
  readonly emptyNode: ReactNode
  readonly includeAction: boolean
  readonly sections: DemoEvidenceViewModel["sections"]
}) =>
  sections.length === 0
    ? emptyNode
    : evidenceSectionsNode({ actions, banner, includeAction, sections })

const actionIcon = (action: RunControlActionKind) =>
  Match.value(action).pipe(
    Match.when("pause", () => <PauseIcon aria-hidden className="h-4 w-4 shrink-0" />),
    Match.when("stop", () => <StopIcon aria-hidden className="h-4 w-4 shrink-0" />),
    Match.when("reset", () => <ArrowPathIcon aria-hidden className="h-4 w-4 shrink-0" />),
    Match.orElse(() => <PlayIcon aria-hidden className="h-4 w-4 shrink-0" />)
  )

const controlActions = ({
  controls,
  onRunControlAction
}: {
  readonly controls: RunControlsViewModel
  readonly onRunControlAction?: ((action: RunControlActionKind) => void) | undefined
}) => {
  if (onRunControlAction === undefined) {
    return undefined
  }

  return (
    <Cluster className="gap-2">
      <ActionButton
        disabled={controls.primary.disabled}
        icon={actionIcon(controls.primary.action)}
        label={controls.primary.label}
        onClick={() => {
          onRunControlAction(controls.primary.action)
        }}
      />
      {Option.match(controls.secondary, {
        onNone: () => null,
        onSome: (secondary) => (
          <ActionButton
            disabled={secondary.disabled}
            icon={actionIcon(secondary.action)}
            label={secondary.label}
            onClick={() => {
              onRunControlAction(secondary.action)
            }}
          />
        )
      })}
    </Cluster>
  )
}

export const EvidenceStage = ({
  controls,
  onRunControlAction,
  viewModel
}: {
  readonly controls: RunControlsViewModel
  readonly onRunControlAction?: ((action: RunControlActionKind) => void) | undefined
  readonly viewModel: DemoEvidenceViewModel
}) => {
  const actions = controlActions({ controls, onRunControlAction })

  return Match.value(viewModel).pipe(
    Match.tag("empty", ({ description }) => <EmptyState action={actions} description={description} />),
    Match.tag("running", ({ banner, description, sections }) =>
      retainedEvidenceNode({
        actions,
        banner,
        emptyNode: <RunningState text={description} />,
        includeAction: false,
        sections
      })),
    Match.tag("paused", ({ banner, description, sections }) =>
      retainedEvidenceNode({
        actions,
        banner,
        emptyNode: <EmptyState action={actions} description={description} />,
        includeAction: true,
        sections
      })),
    Match.tag("stopped", ({ banner, description, sections }) =>
      retainedEvidenceNode({
        actions,
        banner,
        emptyNode: <EmptyState action={actions} description={description} />,
        includeAction: true,
        sections
      })),
    Match.tag("failure", ({ banner, description, sections }) =>
      retainedEvidenceNode({
        actions,
        banner,
        emptyNode: <FailureState action={actions} description={description} />,
        includeAction: true,
        sections
      })),
    Match.tag("results", ({ banner, sections }) =>
      evidenceSectionsNode({
        actions,
        banner,
        includeAction: true,
        sections
      })),
    Match.exhaustive
  )
}

export const DemoStage = ({
  controls,
  interactiveContent,
  onRunControlAction,
  viewModel
}: {
  readonly controls: RunControlsViewModel
  readonly interactiveContent: ReactNode | undefined
  readonly onRunControlAction?: ((action: RunControlActionKind) => void) | undefined
  readonly viewModel: DemoStageViewModel
}) => {
  const evidenceNode = (
    <EvidenceStage controls={controls} onRunControlAction={onRunControlAction} viewModel={viewModel.evidence} />
  )

  if (!viewModel.showTabs || interactiveContent === undefined) {
    return <Layer className="min-h-0 flex-1">{evidenceNode}</Layer>
  }

  return (
    <Stack className="min-h-0 h-full flex-1 gap-0">
      <Layer className={stagePaneClassName(viewModel.activeTab === "interactive")}>{interactiveContent}</Layer>
      <Layer className={stagePaneClassName(viewModel.activeTab === "evidence")}>{evidenceNode}</Layer>
    </Stack>
  )
}
