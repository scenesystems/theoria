import type { PayloadFormat } from "../../../../contracts/presentation/interactions.js"

export const interactionPanelShell = "gap-4"

export const interactionSurfaceShell = interactionPanelShell

export const interactionFlowClassName = "m-0 list-none gap-6 p-0"

export const interactionTurnListClassName = "m-0 list-none gap-7 p-0"

export const interactionEmptyClassName = "text-ink-600"

export const interactionTurnClassName = "relative list-none pl-5 sm:pl-7"

export const interactionTurnRailClassName =
  "absolute bottom-2.5 left-[0.55rem] top-3.5 w-px rounded-full bg-stage-200/80 sm:left-[0.75rem]"

export const interactionTurnBodyClassName = "gap-0"

export const interactionSectionClassName = "gap-2.5 border-l border-stage-300/78 pl-3.5"

export const interactionSectionTitleClassName = "text-ink-500"

export const interactionSectionDividerClassName = "h-px w-full bg-stage-200/80"

export const interactionPayloadSurfaceClassName =
  "overflow-hidden rounded-[0.95rem] bg-stage-100/68 ring-1 ring-inset ring-stage-200/72"

export const interactionPayloadClassName = (format: PayloadFormat): string =>
  format === "json"
    ? "px-3 py-3 whitespace-pre-wrap break-words font-mono text-[0.94rem] leading-6 text-ink-900"
    : "px-3 py-3 whitespace-pre-wrap break-words font-mono text-[0.94rem] leading-6 text-ink-800"
