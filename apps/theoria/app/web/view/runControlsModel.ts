import { Match, Option } from "effect"

import { type RunControlActionKind, runPhase, type RunState } from "../state/run/types.js"

export type RunControlActionViewModel = {
  readonly action: RunControlActionKind
  readonly disabled: boolean
  readonly label: string
}

export type RunControlsViewModel = {
  readonly phase: "idle" | "running" | "paused" | "stopping" | "failed" | "success"
  readonly primary: RunControlActionViewModel
  readonly secondary: Option.Option<RunControlActionViewModel>
}

const action = (
  nextAction: RunControlActionKind,
  label: string,
  disabled = false
): RunControlActionViewModel => ({ action: nextAction, disabled, label })

export const runControlsViewModel = ({
  run,
  runLabel
}: {
  readonly run: RunState
  readonly runLabel: string
}): RunControlsViewModel =>
  Match.value(runPhase(run)).pipe(
    Match.when("idle", (): RunControlsViewModel => ({
      phase: "idle",
      primary: action("run", runLabel),
      secondary: Option.none()
    })),
    Match.when("running", (): RunControlsViewModel => ({
      phase: "running",
      primary: action("pause", "Pause"),
      secondary: Option.some(action("stop", "Stop"))
    })),
    Match.when("paused", (): RunControlsViewModel => ({
      phase: "paused",
      primary: action("resume", "Resume"),
      secondary: Option.some(action("stop", "Stop"))
    })),
    Match.when("stopping", (): RunControlsViewModel => ({
      phase: "stopping",
      primary: action("stop", "Stopping…", true),
      secondary: Option.none()
    })),
    Match.when("failed", (): RunControlsViewModel => ({
      phase: "failed",
      primary: action("run", runLabel),
      secondary: Option.some(action("reset", "Reset"))
    })),
    Match.when("success", (): RunControlsViewModel => ({
      phase: "success",
      primary: action("run", runLabel),
      secondary: Option.some(action("reset", "Reset"))
    })),
    Match.exhaustive
  )
