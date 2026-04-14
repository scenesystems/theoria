import type { KeyboardEventHandler, ReactNode, UIEventHandler } from "react"

import { Box, mergeClassNames } from "../structure/Box.js"

type AppShellWidth = "runway" | "reading"
type AppShellScrollMode = "page" | "body"

const widthClassNames: Record<AppShellWidth, string> = {
  runway: "w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10",
  reading: "mx-auto w-full max-w-[84rem] px-4 py-7 sm:px-7 sm:py-9 lg:px-10"
}

type AppShellProps = {
  readonly atmosphere?: boolean
  readonly bodyClassName?: string
  readonly bodyId?: string
  readonly children: ReactNode
  readonly className?: string
  readonly footer?: ReactNode
  readonly header?: ReactNode
  readonly mainClassName?: string
  readonly onKeyDownCapture?: KeyboardEventHandler<HTMLDivElement>
  readonly onScrollBody?: UIEventHandler<HTMLDivElement>
  readonly scrollMode?: AppShellScrollMode
  readonly width?: AppShellWidth
}

export const AppShell = ({
  atmosphere = true,
  bodyClassName,
  bodyId,
  children,
  className,
  footer,
  header,
  mainClassName,
  onKeyDownCapture,
  onScrollBody,
  scrollMode = "page",
  width = "runway"
}: AppShellProps) => (
  <Box
    className={mergeClassNames(
      "relative min-h-screen overflow-x-hidden bg-stage-50 font-body text-ink-900 antialiased selection:bg-tone-text-200/60 selection:text-ink-950",
      className
    )}
    onKeyDownCapture={onKeyDownCapture}
  >
    {atmosphere
      ? (
        <>
          <Box className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-stage-0/85 blur-3xl" />
          <Box className="pointer-events-none absolute -right-24 top-24 h-[21rem] w-[21rem] rounded-full bg-stage-100/90 blur-3xl" />
        </>
      )
      : null}
    {scrollMode === "body"
      ? (
        <Box className="relative z-10 flex h-screen flex-col">
          {header}
          <Box
            className={mergeClassNames("min-h-0 flex-1 overflow-x-hidden overflow-y-auto", bodyClassName)}
            id={bodyId}
            onScroll={onScrollBody}
          >
            <Box className="flex min-h-full flex-col">
              <Box
                as="main"
                className={mergeClassNames("relative z-10 min-h-0 flex-1", widthClassNames[width], mainClassName)}
              >
                {children}
              </Box>
              {footer}
            </Box>
          </Box>
        </Box>
      )
      : (
        <Box className="relative z-10 flex min-h-screen flex-col">
          {header}
          <Box
            as="main"
            className={mergeClassNames("relative z-10 min-h-0 flex-1", widthClassNames[width], mainClassName)}
          >
            {children}
          </Box>
          {footer}
        </Box>
      )}
  </Box>
)
