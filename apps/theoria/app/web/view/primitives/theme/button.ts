import type { Tone } from "./tone.js"

const pillButtonBaseClassName =
  "inline-flex min-h-9 items-center justify-center rounded-full border px-4 py-2 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const pillButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: Tone
}): string =>
  active
    ? `${pillButtonBaseClassName} border-stage-300/90 bg-stage-0/96 shadow-chip ring-1 ring-stage-0/65 hover:border-stage-400 ${tone.borderSubtle} ${tone.bgTinted}`
    : `${pillButtonBaseClassName} border-stage-200/95 bg-stage-50/72 hover:border-stage-300 hover:bg-stage-0/90`

const segmentedControlRailBaseClassName =
  "grid min-w-0 gap-1 rounded-[1rem] border border-stage-200/80 bg-stage-50/38 p-1"

export const segmentedControlRailClassName = (count: number): string =>
  count <= 2
    ? `${segmentedControlRailBaseClassName} grid-cols-2`
    : count === 3
    ? `${segmentedControlRailBaseClassName} grid-cols-1 sm:grid-cols-3`
    : `${segmentedControlRailBaseClassName} grid-cols-2 sm:grid-cols-4`

const segmentedControlButtonBaseClassName =
  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-[0.9rem] border border-transparent px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const segmentedControlButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: Tone
}): string =>
  active
    ? `${segmentedControlButtonBaseClassName} border-stage-200/80 bg-stage-0/88 ${tone.bgTinted}`
    : `${segmentedControlButtonBaseClassName} hover:border-stage-200/70 hover:bg-stage-0/52`

const panelButtonBaseClassName =
  "inline-flex min-h-11 w-full min-w-0 items-start justify-start rounded-[0.95rem] border px-3.5 py-3 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const panelButtonClassName = ({
  active,
  tone
}: {
  readonly active: boolean
  readonly tone: Tone
}): string =>
  active
    ? `${panelButtonBaseClassName} border-stage-300/84 bg-stage-50/76 ${tone.bgTinted}`
    : `${panelButtonBaseClassName} border-stage-200/70 bg-transparent hover:border-stage-300/80 hover:bg-stage-50/38`

const toggleTrackBaseClassName =
  "inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55"

export const toggleTrackClassName = ({
  checked,
  tone
}: {
  readonly checked: boolean
  readonly tone: Tone
}): string =>
  checked
    ? `${toggleTrackBaseClassName} border-stage-300/90 ${tone.border} ${tone.bgTinted} ${tone.focusRing}`
    : `${toggleTrackBaseClassName} border-stage-200/90 bg-stage-50/90 ${tone.focusRing}`
