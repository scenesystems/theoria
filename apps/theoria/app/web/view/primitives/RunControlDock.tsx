import { Button } from "@base-ui-components/react/button"
import { ArrowPathIcon, PauseIcon, PlayIcon, StopIcon } from "@heroicons/react/20/solid"
import { Match } from "effect"
import * as Option from "effect/Option"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import type { RunControlActionKind } from "../../state/types.js"

import type { RunControlsViewModel } from "../runControlsModel.js"

import type { SurfaceTheme } from "./designSystem.js"
import { headerChromeSurfaceClassName } from "./HeaderChrome.js"
import { Layer } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

const classes = (...entries: ReadonlyArray<string | undefined>): string =>
  entries.filter((entry) => entry !== undefined && entry.length > 0).join(" ")

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

const dockPrimaryButtonClassName = (theme: SurfaceTheme): string =>
  classes(
    "relative z-10 inline-flex h-11 min-w-0 items-center justify-center gap-2.5 rounded-none border px-5 shadow-chip",
    "transition-[transform,border-color,background-color,color] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1",
    theme.primaryAction
  )

const dockArmBaseClassName = classes(
  "absolute top-1/2 inline-flex h-11 min-w-11 items-center overflow-hidden shadow-chip",
  "transition-[max-width,padding,border-color,background-color,color,opacity,transform] duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1",
  headerChromeSurfaceClassName
)

const dockStatusArmClassName = (phase: RunControlsViewModel["phase"]): string =>
  classes(
    dockArmBaseClassName,
    "right-[calc(100%-0.1rem)] z-0 -translate-y-1/2 justify-end rounded-l-[1.2rem] rounded-r-none border-r-0 pl-3 pr-3",
    "max-w-11 group-hover:max-w-[8rem] group-hover:pl-4 group-hover:pr-4",
    "group-focus-within:max-w-[8rem] group-focus-within:pl-4 group-focus-within:pr-4",
    Match.value(phase).pipe(
      Match.when("failed", () => "pointer-events-none border-danger-200/90 bg-danger-50/80 text-danger-700"),
      Match.when("running", () => "pointer-events-none border-ink-300/84 bg-stage-0/92 text-ink-900"),
      Match.when("paused", () => "pointer-events-none border-stage-300/92 bg-stage-50/84 text-ink-800"),
      Match.when("stopping", () => "pointer-events-none border-stage-300/92 bg-stage-50/84 text-ink-800"),
      Match.when("success", () => "pointer-events-none border-ink-300/82 bg-stage-0/90 text-ink-900"),
      Match.orElse(() => "pointer-events-none border-stage-200/88 bg-stage-0/78 text-ink-700")
    )
  )

const dockStatusTextClassName = (phase: RunControlsViewModel["phase"]): string =>
  classes(
    "max-w-0 overflow-hidden whitespace-nowrap pr-0 opacity-0",
    "transition-[max-width,opacity,transform,padding] duration-200 ease-out translate-x-1",
    "group-hover:max-w-[5.25rem] group-hover:pr-2 group-hover:opacity-100 group-hover:translate-x-0",
    "group-focus-within:max-w-[5.25rem] group-focus-within:pr-2 group-focus-within:opacity-100 group-focus-within:translate-x-0",
    statusLabelClassName(phase)
  )

const dockAccessoryArmClassName = (disabled: boolean): string =>
  classes(
    dockArmBaseClassName,
    "left-[calc(100%-0.1rem)] z-0 -translate-y-1/2 justify-start rounded-l-none rounded-r-[1.2rem] border-l-0 pl-3 pr-3",
    "max-w-11 group-hover:max-w-[8rem] group-hover:pl-3.5 group-hover:pr-4",
    "group-focus-within:max-w-[8rem] group-focus-within:pl-3.5 group-focus-within:pr-4",
    disabled
      ? "cursor-not-allowed border-stage-200/84 bg-stage-0/70 text-ink-500"
      : "border-stage-300/88 bg-stage-0/94 text-ink-900 hover:border-stage-400 hover:bg-stage-50/84"
  )

const dockAccessoryTextClassName =
  "max-w-0 overflow-hidden whitespace-nowrap pl-0 opacity-0 transition-[max-width,opacity,transform,padding] duration-200 ease-out -translate-x-1 group-hover:max-w-[5.25rem] group-hover:pl-2 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:max-w-[5.25rem] group-focus-within:pl-2 group-focus-within:opacity-100 group-focus-within:translate-x-0"

const statusLabelClassName = (phase: RunControlsViewModel["phase"]): string =>
  Match.value(phase).pipe(
    Match.when("failed", () => "text-danger-700"),
    Match.when("running", () => "text-ink-900"),
    Match.when("paused", () => "text-ink-800"),
    Match.when("stopping", () => "text-ink-800"),
    Match.when("success", () => "text-ink-900"),
    Match.orElse(() => "text-ink-700")
  )

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

export const RunControlDock = ({
  controls,
  onRunControlAction,
  theme,
  variant
}: {
  readonly controls: RunControlsViewModel
  readonly onRunControlAction: (action: RunControlActionKind) => void
  readonly theme: SurfaceTheme
  readonly variant: SurfaceVariant
}) => {
  const accessory = resolvedDockAccessoryControl(controls)

  return (
    <Layer className="group relative isolate inline-flex items-center justify-center overflow-visible px-1 py-1">
      <Layer as="span" aria-live="polite" className={dockStatusArmClassName(controls.phase)}>
        <SemanticText
          as="span"
          className={dockStatusTextClassName(controls.phase)}
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

      <Button
        className={dockPrimaryButtonClassName(theme)}
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

      <Button
        className={dockAccessoryArmClassName(accessory.disabled)}
        disabled={accessory.disabled}
        onClick={() => {
          onRunControlAction(accessory.action)
        }}
        type="button"
      >
        {controlIcon(accessory.action)}
        <SemanticText
          as="span"
          className={dockAccessoryTextClassName}
          role="button-label"
          text={accessory.label}
          variant={variant}
        />
      </Button>
    </Layer>
  )
}
