import type { CardTone } from "../../../../contracts/tone.js"

export type SurfaceMaterials = {
  readonly raisedCard: string
  readonly supportPanel: string
  readonly supportPanelDense: string
  readonly instrumentPanel: string
  readonly instrumentSection: string
  readonly instrumentViewport: string
  readonly stripPanel: string
  readonly metricHeroPanel: string
  readonly callout: string
  readonly calloutError: string
  readonly evidenceCardFrame: string
  readonly evidenceCard: string
  readonly evidenceProse: string
  readonly evidenceLane: string
  readonly evidenceToolbar: string
  readonly evidenceToolbarDock: string
  readonly chartFrame: string
}

export const surfaceMaterials: SurfaceMaterials = {
  raisedCard:
    "rounded-[2rem] border border-stage-300/95 bg-stage-0/94 shadow-hero ring-1 ring-stage-0/80 backdrop-blur-sm",
  supportPanel: "border-y border-stage-200/84 bg-stage-0/72",
  supportPanelDense: "border-y border-stage-200/84 bg-stage-0/72 px-3 py-2",
  instrumentPanel: "gap-0",
  instrumentSection: "border-b border-stage-200/72 pb-4",
  instrumentViewport: "pt-5",
  stripPanel: "border border-stage-200/74 bg-stage-0/28",
  metricHeroPanel: "border border-stage-200/82 bg-stage-0/34",
  callout: "rounded-md border border-stage-200/95 bg-stage-50/85 px-3 py-3",
  calloutError: "rounded-md border border-danger-200/80 bg-danger-50/70 px-3 py-3",
  evidenceCardFrame: "rounded-lg border border-stage-200/80 bg-stage-0/60",
  evidenceCard: "rounded-lg border border-stage-200/80 bg-stage-0/60 px-4 py-3",
  evidenceProse: "rounded-[1.35rem] border border-stage-200/70 bg-stage-50/46 shadow-chip",
  evidenceToolbar: "rounded-[1.75rem] border border-stage-200/90 bg-stage-0/94 shadow-chip",
  evidenceLane: "rounded-[1.15rem] border border-stage-200/72 bg-stage-50/32 px-4 py-4",
  evidenceToolbarDock:
    "rounded-[1.45rem] border border-stage-200/86 bg-stage-0/90 shadow-[0_24px_72px_-52px_rgba(15,23,42,0.42)] ring-1 ring-stage-0/68 backdrop-blur-xl",
  chartFrame: "overflow-hidden rounded-[1.35rem] border border-stage-200/74 bg-stage-0/42 shadow-chip"
}

export const app = {
  root:
    "relative min-h-screen overflow-x-hidden bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  atmosphericGlowA: "pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-stage-0/85 blur-3xl",
  atmosphericGlowB:
    "pointer-events-none absolute -right-24 top-24 h-[21rem] w-[21rem] rounded-full bg-stage-100/90 blur-3xl",
  content: "relative mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-4 py-7 sm:px-7 sm:py-9 lg:px-10",
  sectionGutter: "px-4 sm:px-6 lg:px-8 2xl:px-10",
  compactNav:
    "border-b border-stage-200/90 bg-stage-0/88 px-4 py-3 backdrop-blur-xl shadow-[0_18px_60px_-52px_rgba(15,23,42,0.65)] sm:px-6 sm:py-4",
  homeGrid: "grid grid-cols-1 gap-4 xl:grid-cols-2"
}

export type CodePanel = {
  readonly bg: string
  readonly action: string
  readonly codeContainer: string
  readonly editorHeader: string
  readonly explorer: string
  readonly explorerItem: string
  readonly explorerItemActive: string
  readonly metaBorder: string
  readonly metaHint: string
  readonly metaLabel: string
  readonly metaValue: string
  readonly scrollbar: string
  readonly scrollCorner: string
  readonly statusBar: string
  readonly title: string
  readonly workspace: string
}

export type Surface = {
  readonly shell: string
  readonly accent: string
  readonly badge: string
  readonly badgeDot: string
  readonly statusTag: string
  readonly primaryAction: string
  readonly backAction: string
  readonly secondaryAction: string
  readonly splitDivider: string
  readonly splitHandle: string
  readonly tabActive: string
  readonly tabInactive: string
  readonly panel: string
  readonly supportPanel: string
  readonly codePanel: CodePanel
}

const shellShared = "border-y border-stage-300/84 bg-stage-0/86"
const panelShared = "bg-stage-0/74"
const statusTagShared = "border-stage-200/84 bg-stage-0/72 text-ink-900"
const actionShared = "shadow-chip focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1"
const primaryActionShared = "border-ink-900/90 bg-ink-900 text-stage-0 hover:border-ink-800 hover:bg-ink-800"
const backActionShared =
  "border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-100/80 hover:text-ink-900"
const secondaryActionShared =
  "border-stage-300 bg-stage-0/96 text-ink-800 hover:border-stage-400 hover:bg-stage-50 hover:text-ink-900"
const splitDividerShared =
  "bg-stage-200/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-0 hover:bg-stage-300/95"
const splitHandleShared =
  "after:absolute after:left-1/2 after:top-1/2 after:h-14 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-stage-300 after:bg-stage-0/96 after:shadow-chip"
const tabActiveShared = "border-stage-300 bg-stage-0/98 text-ink-900 shadow-chip"
const tabInactiveShared =
  "border-transparent bg-transparent text-ink-700 hover:border-stage-300 hover:bg-stage-0/90 hover:text-ink-900"

const codePanelShared: CodePanel = {
  bg: "bg-stage-100",
  action:
    "shadow-chip border-stage-300/60 bg-stage-100/80 text-ink-700 hover:border-stage-400 hover:bg-stage-200/80 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/25 focus-visible:ring-offset-1",
  codeContainer: "bg-stage-50",
  editorHeader: "bg-stage-50/92",
  explorer: "bg-stage-100/84",
  explorerItem:
    "border-transparent bg-transparent text-ink-700 hover:border-stage-300/70 hover:bg-stage-50/88 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
  explorerItemActive:
    "border-stage-300/90 bg-stage-0/96 text-ink-900 shadow-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20 focus-visible:ring-offset-1",
  metaBorder: "border-stage-200/60",
  metaHint: "text-ink-700/60",
  metaLabel: "text-ink-700",
  metaValue: "text-ink-800",
  scrollbar: "bg-stage-200/40",
  scrollCorner: "bg-stage-100",
  statusBar: "bg-stage-100/88",
  title: "text-ink-900",
  workspace: "bg-stage-100"
}

type ToneSurfaceAccent = {
  readonly accent: string
  readonly badgeDot: string
}

const digestSurfaceAccent: ToneSurfaceAccent = {
  accent: "bg-gradient-to-r from-tone-digest-600 via-tone-digest-500 to-tone-digest-400",
  badgeDot: "bg-tone-digest-500"
}

const surfaceForTone = (_tone: CardTone): Surface => ({
  shell: shellShared,
  accent: digestSurfaceAccent.accent,
  badge: "border-stage-300/90 bg-stage-0/96 text-ink-800 shadow-chip",
  badgeDot: digestSurfaceAccent.badgeDot,
  statusTag: statusTagShared,
  primaryAction: `${actionShared} ${primaryActionShared}`,
  backAction: `${actionShared} ${backActionShared}`,
  secondaryAction: `${actionShared} ${secondaryActionShared}`,
  splitDivider: splitDividerShared,
  splitHandle: splitHandleShared,
  tabActive: tabActiveShared,
  tabInactive: tabInactiveShared,
  panel: panelShared,
  supportPanel: "bg-stage-50/42",
  codePanel: codePanelShared
})

export const surfaceForCard = (_id: string): Surface => surfaceForTone("digest")
