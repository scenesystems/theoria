import { Match, Option } from "effect"

import { type RunControlActionKind, runPhase, type RunState } from "../state/types.js"

export type RunControlActionViewModel = {
  readonly action: RunControlActionKind
  readonly disabled: boolean
  readonly label: string
}

export type RunControlsViewModel = {
  readonly phase:
    | "checking"
    | "unavailable"
    | "idle"
    | "running"
    | "paused"
    | "stopping"
    | "stopped"
    | "failed"
    | "success"
  readonly primary: RunControlActionViewModel
  readonly secondary: Option.Option<RunControlActionViewModel>
}

export type RunAvailability = "checking" | "available" | "unavailable"

const action = (
  nextAction: RunControlActionKind,
  label: string,
  disabled = false
): RunControlActionViewModel => ({ action: nextAction, disabled, label })

const runAction = (runLabel: string, availability: RunAvailability): RunControlActionViewModel =>
  Match.value(availability).pipe(
    Match.when("checking", () => action("run", "Checking Provider…", true)),
    Match.when("unavailable", () => action("run", "Provider Unavailable", true)),
    Match.when("available", () => action("run", runLabel)),
    Match.exhaustive
  )

const idlePhase = (availability: RunAvailability): RunControlsViewModel["phase"] =>
  Match.value(availability).pipe(
    Match.when("checking", (): RunControlsViewModel["phase"] => "checking"),
    Match.when("unavailable", (): RunControlsViewModel["phase"] => "unavailable"),
    Match.when("available", (): RunControlsViewModel["phase"] => "idle"),
    Match.exhaustive
  )

const availabilityForRun = (run: RunState, availability: RunAvailability): RunAvailability =>
  Match.value(run).pipe(
    Match.tag("RunFailed", ({ error }) =>
      error._tag === "DemoExecutionError" && error.code === "provider-unavailable"
        ? "unavailable"
        : availability),
    Match.orElse(() => availability)
  )

export const runControlsViewModel = ({
  availability = "available",
  run,
  runLabel
}: {
  readonly availability?: RunAvailability
  readonly run: RunState
  readonly runLabel: string
}): RunControlsViewModel => {
  const currentAvailability = availabilityForRun(run, availability)

  return Match.value(runPhase(run)).pipe(
    Match.when("idle", (): RunControlsViewModel => ({
      phase: idlePhase(currentAvailability),
      primary: runAction(runLabel, currentAvailability),
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
    Match.when("stopped", (): RunControlsViewModel => ({
      phase: "stopped",
      primary: runAction(runLabel, currentAvailability),
      secondary: Option.some(action("reset", "Reset"))
    })),
    Match.when("failed", (): RunControlsViewModel => ({
      phase: "failed",
      primary: runAction(runLabel, currentAvailability),
      secondary: Option.some(action("reset", "Reset"))
    })),
    Match.when("success", (): RunControlsViewModel => ({
      phase: "success",
      primary: runAction(runLabel, currentAvailability),
      secondary: Option.some(action("reset", "Reset"))
    })),
    Match.exhaustive
  )
}
