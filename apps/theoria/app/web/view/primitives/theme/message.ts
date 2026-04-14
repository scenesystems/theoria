import { Match } from "effect"

import type {
  MessageAlignment,
  MessageRole,
  MessageStatus,
  MessageTextKind
} from "../../../../contracts/presentation/interactions.js"

export const messageRowClassName = (alignment: MessageAlignment): string =>
  alignment === "end"
    ? "grid list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-4"
    : "grid list-none grid-cols-[auto_minmax(0,1fr)] items-start gap-4"

export const messageBodyClassName = (alignment: MessageAlignment): string =>
  alignment === "end" ? "items-end justify-self-end gap-2.5" : "items-start gap-2.5"

export const messageHeaderClassName = (alignment: MessageAlignment): string =>
  alignment === "end" ? "items-end gap-1 px-1 text-right" : "items-start gap-1 px-1"

export const messageMetaClusterClassName = (alignment: MessageAlignment): string =>
  alignment === "end" ? "justify-end gap-x-2 gap-y-1" : "gap-x-2 gap-y-1"

export const messageTitleClassName = "text-ink-900"

export const messageMetaTextClassName = "text-ink-500"

export const messageFrameClassName = ({
  role,
  status
}: {
  readonly role: MessageRole
  readonly status: MessageStatus
}): string => {
  const base = "w-full rounded-[1.45rem] border px-4 py-3.5 shadow-chip"

  return status === "error"
    ? `${base} border-danger-200/90 bg-danger-50/76`
    : status === "active"
    ? `${base} border-tone-dsp-300/92 bg-tone-dsp-100/42 ring-1 ring-tone-dsp-200/70`
    : Match.value(role).pipe(
      Match.when("user", () => `${base} border-stage-300/92 bg-stage-100/92`),
      Match.when("assistant", () => `${base} border-tone-dsp-200/90 bg-tone-dsp-100/26`),
      Match.when("tool", () => `${base} border-stage-300/92 bg-stage-50/94`),
      Match.when("runtime", () => `${base} border-stage-200/90 bg-stage-50/78`),
      Match.when("system", () => `${base} border-stage-200/90 bg-stage-50/78`),
      Match.when("custom", () => `${base} border-stage-200/90 bg-stage-0/96`),
      Match.exhaustive
    )
}

export const messageAvatarClassName = (role: MessageRole): string =>
  Match.value(role).pipe(
    Match.when("user", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stage-300/92 bg-stage-100 text-ink-900 shadow-chip"),
    Match.when("assistant", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-tone-dsp-200/90 bg-tone-dsp-100/45 text-tone-dsp-900 shadow-chip"),
    Match.when("tool", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stage-300/92 bg-stage-50 text-ink-900 shadow-chip"),
    Match.when("runtime", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stage-200/90 bg-stage-50 text-ink-800 shadow-chip"),
    Match.when("system", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stage-200/90 bg-stage-50 text-ink-800 shadow-chip"),
    Match.when("custom", () =>
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stage-200/90 bg-stage-0 text-ink-800 shadow-chip"),
    Match.exhaustive
  )

export const messageTextClassName = (kind: MessageTextKind): string =>
  Match.value(kind).pipe(
    Match.when("body", () => "text-ink-900"),
    Match.when("thinking", () => "text-ink-700 italic"),
    Match.when("meta", () => "text-ink-600"),
    Match.exhaustive
  )
