export const docsTheme = {
  root:
    "relative min-h-dvh overflow-x-hidden bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
  header: "sticky top-0 z-50 border-b border-stage-200/85 bg-stage-50/86 backdrop-blur-xl",
  headerContent:
    "mx-auto flex min-h-[4.5rem] w-full max-w-[96rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8",
  workbench:
    "relative mx-auto grid w-full max-w-[96rem] grid-cols-1 lg:grid-cols-[16.5rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)_13rem]",
  sidebar: "hidden min-w-0 border-r border-stage-200/80 px-5 py-7 lg:block lg:min-h-[calc(100dvh-4.5rem)]",
  sidebarSticky: "sticky top-[6.25rem] max-h-[calc(100dvh-7.75rem)] overflow-y-auto pr-1",
  main: "min-w-0 px-4 py-8 sm:px-7 sm:py-10 lg:px-10 xl:px-12",
  article: "mx-auto w-full max-w-[54rem]",
  toc: "hidden min-w-0 px-5 py-8 xl:block",
  tocSticky: "sticky top-[6.25rem]",
  navLink:
    "group flex min-w-0 items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-ink-700 transition-[border-color,background-color,color] duration-150 hover:border-stage-200/90 hover:bg-stage-0/72 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20",
  navLinkActive: "border-stage-300/85 bg-stage-0/92 text-ink-950 shadow-chip",
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
  drawerViewport: "fixed inset-0 z-[90] flex justify-start",
  drawer:
    "h-full w-[min(22rem,88vw)] overflow-y-auto border-r border-stage-300/90 bg-stage-0/98 shadow-hero transition-transform duration-150 data-[starting-style]:translate-x-[-100%] data-[ending-style]:translate-x-[-100%]",
  code: "overflow-hidden rounded-[1.35rem] border border-stage-200/90 bg-stage-0/92 shadow-chip"
}
