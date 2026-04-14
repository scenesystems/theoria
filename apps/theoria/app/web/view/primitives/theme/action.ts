import { Match } from "effect"

import type { ActionKind, ActionStatus } from "../../../../contracts/presentation/interactions.js"

export const actionFrameClassName = ({
  kind,
  status
}: {
  readonly kind: ActionKind
  readonly status: ActionStatus
}): string => {
  const base = "w-full rounded-[1.2rem] border px-4 py-3.5 shadow-chip"

  return status === "error"
    ? `${base} border-danger-200/90 bg-danger-50/72`
    : status === "active"
    ? `${base} border-tone-dsp-300/92 bg-tone-dsp-100/32 ring-1 ring-tone-dsp-200/70`
    : status === "success"
    ? `${base} border-stage-300/90 bg-stage-50/92`
    : Match.value(kind).pipe(
      Match.when("tool", () => `${base} border-stage-300/88 bg-stage-50/88`),
      Match.when("command", () => `${base} border-stage-300/88 bg-stage-50/88`),
      Match.when("runtime", () => `${base} border-stage-200/88 bg-stage-50/76`),
      Match.when("custom", () => `${base} border-stage-200/88 bg-stage-0/78`),
      Match.exhaustive
    )
}

export const actionHeaderClassName = "gap-2"

export const actionTitleRailClassName = "justify-between gap-3"

export const actionEyebrowClassName = "text-ink-500"

export const actionTitleClassName = "text-ink-900"

export const actionMetaClassName = "gap-x-2 gap-y-1"

export const actionMetaTextClassName = "text-ink-500"

export const actionStatusClassName = (status: ActionStatus): string =>
  Match.value(status).pipe(
    Match.when("default", () => "text-ink-500"),
    Match.when("active", () => "text-tone-dsp-800"),
    Match.when("success", () => "text-ink-700"),
    Match.when("error", () => "text-danger-700"),
    Match.exhaustive
  )
