import { Match } from "effect"

import type {
  MessageAlignment,
  MessageDataDisplay,
  MessageRole,
  MessageStatus,
  MessageTextKind
} from "../../../../contracts/presentation/interactions.js"

export const messagePanelShell = "rounded-[1.75rem] border border-stage-200/90 bg-stage-0/90 p-4 shadow-chip sm:p-5"

export const messageRowClassName = (alignment: MessageAlignment): string =>
  alignment === "end" ? "justify-end" : "justify-start"

export const messageBubbleClassName = ({
  role,
  status
}: {
  readonly role: MessageRole
  readonly status: MessageStatus
}): string => {
  const base = "max-w-[46rem] rounded-[1.35rem] border px-4 py-3 shadow-chip"

  return status === "error"
    ? `${base} border-danger-200/90 bg-danger-50/72`
    : Match.value(role).pipe(
      Match.when("user", () => `${base} border-stage-300/92 bg-stage-100/92`),
      Match.when("assistant", () => `${base} border-tone-dsp-200/90 bg-tone-dsp-100/35`),
      Match.when("tool", () => `${base} border-stage-300/92 bg-stage-50/96`),
      Match.when("runtime", () => `${base} border-stage-200/90 bg-stage-50/80`),
      Match.when("system", () => `${base} border-stage-200/90 bg-stage-50/80`),
      Match.when("custom", () => `${base} border-stage-200/90 bg-stage-0/94`),
      Match.exhaustive
    )
}

export const messageAvatarClassName = (role: MessageRole): string =>
  Match.value(role).pipe(
    Match.when("user", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-stage-300/92 bg-stage-100 text-ink-900"),
    Match.when("assistant", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-tone-dsp-200/90 bg-tone-dsp-100/45 text-tone-dsp-900"),
    Match.when("tool", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-stage-300/92 bg-stage-50 text-ink-900"),
    Match.when("runtime", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-stage-200/90 bg-stage-50 text-ink-800"),
    Match.when("system", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-stage-200/90 bg-stage-50 text-ink-800"),
    Match.when("custom", () =>
      "flex h-10 w-10 items-center justify-center rounded-full border border-stage-200/90 bg-stage-0 text-ink-800"),
    Match.exhaustive
  )

export const messageTextClassName = (kind: MessageTextKind): string =>
  Match.value(kind).pipe(
    Match.when("body", () => "text-ink-900"),
    Match.when("thinking", () => "text-ink-700 italic"),
    Match.when("meta", () => "text-ink-600"),
    Match.exhaustive
  )

export const messageDataBlockClassName = (_display: MessageDataDisplay): string =>
  "rounded-2xl border border-stage-200/86 bg-stage-0/84 px-3 py-3"

export const messageDataValueClassName = (display: MessageDataDisplay): string =>
  display === "json" ? "font-mono text-[0.8rem] leading-6 text-ink-800 whitespace-pre-wrap" : "text-ink-800"
