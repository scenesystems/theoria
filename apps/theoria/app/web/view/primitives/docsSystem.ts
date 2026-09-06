export const docsTheme = {
  root:
    "relative min-h-dvh overflow-x-clip bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  header: "sticky top-0 z-50 border-b border-stage-200/85 bg-stage-50/86 backdrop-blur-xl",
  headerContent:
    "mx-auto flex min-h-[4.5rem] w-full max-w-[96rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8",
  workbench:
    "relative mx-auto grid w-full max-w-[96rem] grid-cols-1 lg:grid-cols-[17.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)_13rem]",
  sidebar:
    "hidden min-w-0 border-r border-stage-200/80 bg-stage-50/72 px-5 py-7 lg:block lg:min-h-[calc(100dvh-4.5rem)]",
  sidebarSticky: "sticky top-[6.25rem] max-h-[calc(100dvh-7.75rem)] overflow-y-auto pr-1",
  main: "min-w-0 px-4 py-8 sm:px-7 sm:py-10 lg:px-10 xl:px-12",
  article: "mx-auto w-full max-w-[54rem]",
  toc: "hidden min-w-0 px-5 py-8 xl:block",
  tocSticky: "sticky top-[6.25rem] max-h-[calc(100dvh-7.75rem)] overflow-y-auto pr-1",
  navLink:
    "group relative flex min-w-0 items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-ink-700 transition-[border-color,background-color,color] duration-150 hover:border-stage-200/90 hover:bg-stage-0/72 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20",
  navLinkActive:
    "border-stage-300/85 bg-stage-0/92 text-ink-950 shadow-chip before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-0.5 before:rounded-full before:bg-ink-700",
  navChildLink:
    "group relative flex min-w-0 items-start rounded-lg px-3 py-2 text-ink-600 outline-none transition-[background-color,color] hover:bg-stage-0/72 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/20",
  navChildLinkActive:
    "bg-stage-0/86 text-ink-950 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-ink-700",
  searchTrigger:
    "flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-stage-200/90 bg-stage-0/78 px-3 text-ink-600 shadow-chip transition-[border-color,background-color,color] hover:border-stage-300 hover:bg-stage-0/95 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20",
  iconButton:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stage-200/90 bg-stage-0/76 text-ink-700 transition-[border-color,background-color,color] hover:border-stage-300 hover:bg-stage-0/96 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20",
  primaryAction: "border-ink-900/90 bg-ink-900 text-stage-0 shadow-chip hover:border-ink-800 hover:bg-ink-800",
  secondaryAction: "border-stage-300/90 bg-stage-0/88 text-ink-900 shadow-chip hover:border-ink-400 hover:bg-stage-0",
  dialogBackdrop:
    "fixed inset-0 z-[80] bg-ink-950/25 backdrop-blur-sm transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
  dialogViewport: "fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto px-3 py-[10dvh] sm:px-6",
  searchDialog:
    "w-full max-w-[42rem] overflow-hidden rounded-[1.65rem] border border-stage-300/90 bg-stage-0/98 shadow-hero ring-1 ring-stage-0/70 transition-[opacity,transform] duration-150 data-[starting-style]:translate-y-[-0.5rem] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[-0.5rem] data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0",
  drawerBackdrop:
    "fixed inset-0 z-[80] min-h-dvh bg-ink-950 backdrop-blur-sm opacity-[calc(0.25*(1-var(--drawer-swipe-progress)))] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[swiping]:duration-0 data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*300ms)]",
  drawerViewport: "fixed inset-0 z-[90] flex justify-start",
  drawer:
    "h-full w-[min(22rem,88vw)] translate-x-[var(--drawer-swipe-movement-x)] touch-auto overflow-y-auto overscroll-contain border-r border-stage-300/90 bg-stage-0/98 shadow-hero outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full data-[ending-style]:duration-[calc(var(--drawer-swipe-strength)*300ms)] data-[swiping]:select-none",
  code: "overflow-hidden rounded-[1.35rem] border border-stage-200/90 bg-stage-0/92 shadow-chip",
  codeAction:
    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-stage-200/90 bg-stage-0/78 px-3 text-ink-600 transition-colors hover:border-stage-300 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"
}
