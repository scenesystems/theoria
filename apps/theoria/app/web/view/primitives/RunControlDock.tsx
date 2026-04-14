import { Button } from "@base-ui/react/button"
import { ArrowPathIcon, PauseIcon, PlayIcon, StopIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"
import * as Option from "effect/Option"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"
import type { RunControlsViewModel } from "../../../contracts/presentation/run-controls.js"
import type { RunControlActionKind } from "../../state/run/types.js"

import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { Surface } from "./theme/surface.js"

const controlIcon = (action: RunControlActionKind) =>
  Match.value(action).pipe(
    Match.when("reset", () => <ArrowPathIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />),
    Match.when("pause", () => <PauseIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />),
    Match.when("stop", () => <StopIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />),
    Match.orElse(() => <PlayIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />)
  )

type DockAccessoryControl = {
  readonly action: RunControlActionKind
  readonly disabled: boolean
  readonly label: string
}

const dockAccessoryControl = (
  action: RunControlActionKind,
  label: string,
  disabled: boolean
): DockAccessoryControl => ({ action, disabled, label })

const statusDotClassName = (phase: RunControlsViewModel["phase"]): string =>
  Match.value(phase).pipe(
    Match.when("running", () => "bg-ink-900"),
    Match.when("paused", () => "bg-stage-500"),
    Match.when("stopping", () => "bg-stage-500"),
    Match.when("failed", () => "bg-danger-500"),
    Match.when("success", () => "bg-ink-900"),
    Match.orElse(() => "bg-stage-400")
  )

const statusHaloClassName = (phase: RunControlsViewModel["phase"]): string | null =>
  Match.value(phase).pipe(
    Match.when("running", () => "bg-ink-900/20"),
    Match.when("paused", () => "bg-stage-400/20"),
    Match.when("stopping", () => "bg-stage-500/20"),
    Match.orElse(() => null)
  )

const statusLabelClassName = (phase: RunControlsViewModel["phase"]): string =>
  Match.value(phase).pipe(
    Match.when("failed", () => "text-danger-700"),
    Match.when("running", () => "text-ink-900"),
    Match.when("paused", () => "text-ink-800"),
    Match.when("stopping", () => "text-ink-800"),
    Match.when("success", () => "text-ink-900"),
    Match.orElse(() => "text-ink-700")
  )

const statusLabel = (phase: RunControlsViewModel["phase"]): string =>
  Match.value(phase).pipe(
    Match.when("running", () => "Running"),
    Match.when("paused", () => "Paused"),
    Match.when("stopping", () => "Stopping"),
    Match.when("failed", () => "Failed"),
    Match.when("success", () => "Complete"),
    Match.orElse(() => "Ready")
  )

const resolvedDockAccessoryControl = (controls: RunControlsViewModel): DockAccessoryControl =>
  Option.match(controls.secondary, {
    onNone: () =>
      Match.value(controls.phase).pipe(
        Match.when("stopping", () => dockAccessoryControl("stop", "Stop", true)),
        Match.orElse(() => dockAccessoryControl("reset", "Reset", true))
      ),
    onSome: (secondary) => secondary
  })

const dockShellClassName =
  "group relative inline-flex h-11 items-center border border-stage-200/88 bg-stage-0/78 shadow-chip backdrop-blur-md rounded-[1.2rem]"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1"

const dockDivider = "w-px self-stretch bg-stage-200/80 shrink-0"

const statusArmClassName =
  "inline-flex h-full shrink-0 items-center justify-end gap-2 overflow-hidden px-3 transition-[max-width,padding] duration-200 ease-out max-w-11 group-hover:max-w-[9rem] group-hover:px-3.5 group-focus-within:max-w-[9rem] group-focus-within:px-3.5"

const statusTextClassName = (phase: RunControlsViewModel["phase"]): string =>
  [
    "whitespace-nowrap opacity-0 transition-opacity duration-200 ease-out",
    "group-hover:opacity-100 group-focus-within:opacity-100",
    statusLabelClassName(phase)
  ].join(" ")

const accessoryArmClassName = (disabled: boolean): string =>
  [
    "inline-flex h-full shrink-0 items-center justify-start gap-2 overflow-hidden rounded-r-[calc(1.2rem-1px)] px-3 transition-[max-width,padding,background-color] duration-200 ease-out",
    "max-w-11 group-hover:max-w-[9rem] group-hover:px-3.5 group-focus-within:max-w-[9rem] group-focus-within:px-3.5",
    focusRing,
    disabled
      ? "cursor-not-allowed text-ink-500"
      : "text-ink-900 hover:bg-stage-50/84"
  ].join(" ")

const accessoryTextClassName =
  "whitespace-nowrap opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100"

export const RunControlDock = ({
  controls,
  onRunControlAction,
  theme: _theme,
  variant
}: {
  readonly controls: RunControlsViewModel
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly theme: Surface
  readonly variant: SurfaceVariant
}) => {
  const accessory = resolvedDockAccessoryControl(controls)

  return (
    <Layer className={dockShellClassName}>
      <Layer as="span" aria-live="polite" className={statusArmClassName}>
        <SemanticText
          as="span"
          className={statusTextClassName(controls.phase)}
          role="status"
          text={statusLabel(controls.phase)}
          variant={variant}
        />
        <Layer className="relative h-2.5 w-2.5 shrink-0">
          {statusHaloClassName(controls.phase) === null
            ? null
            : (
              <Layer
                aria-hidden
                className={`absolute inset-0 rounded-full animate-ping ${statusHaloClassName(controls.phase)}`}
              />
            )}
          <Layer
            as="span"
            aria-hidden
            className={`relative block h-2.5 w-2.5 rounded-full ${statusDotClassName(controls.phase)}`}
          />
        </Layer>
      </Layer>

      <Layer aria-hidden className={dockDivider} />

      <Button
        className={`inline-flex h-full shrink-0 items-center justify-center gap-2.5 px-5 text-ink-900 transition-colors duration-200 ease-out hover:bg-stage-50/84 ${focusRing}`}
        disabled={controls.primary.disabled}
        onClick={() => {
          onRunControlAction(controls.primary.action)
        }}
        type="button"
      >
        {controlIcon(controls.primary.action)}
        <SemanticText
          as="span"
          className="max-w-full whitespace-nowrap"
          role="button-label"
          text={controls.primary.label}
          variant={variant}
        />
      </Button>

      <Layer aria-hidden className={dockDivider} />

      <Button
        className={accessoryArmClassName(accessory.disabled)}
        disabled={accessory.disabled}
        onClick={() => {
          onRunControlAction(accessory.action)
        }}
        type="button"
      >
        {controlIcon(accessory.action)}
        <SemanticText
          as="span"
          className={accessoryTextClassName}
          role="button-label"
          text={accessory.label}
          variant={variant}
        />
      </Button>
    </Layer>
  )
}
