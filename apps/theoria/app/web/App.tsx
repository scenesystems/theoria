import { CSPProvider } from "@base-ui/react/csp-provider"
import { Tooltip } from "@base-ui/react/tooltip"
import { Atom, Result } from "@effect-atom/atom"
import { RegistryProvider, useAtomMount, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Data, Effect, Match } from "effect"
import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import type { ReactNode } from "react"

import type { DocsRoute } from "../contracts/docs.js"
import { motionConfigReducedMotion, motionPreferenceAtom } from "./atoms/motion.js"
import { browserMetadataMountAtom, browserNavigationMountAtom, pageRouteAtom } from "./atoms/navigation.js"
import { appRuntime } from "./atoms/runtime.js"
import { colorModeApplicationAtom } from "./atoms/theme.js"
import * as BrowserWindow from "./platform/BrowserWindow.js"
import { DocsHeader } from "./view/docs/DocsHeader.js"
import { DocsStatus } from "./view/docs/DocsStatus.js"
import { HomePage } from "./view/home/HomePage.js"
import { appTheme, workbenchTheme } from "./view/primitives/designSystem.js"
import { Layer, Main } from "./view/primitives/Layout.js"
import { themeTransition } from "./view/primitives/motion.js"

import "./styles.css"

class DocsLoadFailed extends Data.TaggedError("DocsLoadFailed") {}

/** Documentation renderers and mathematical typesetting load only on a docs route. */
const docsPageAtom = Atom.make(Effect.tryPromise({
  try: () => import("./view/docs/DocsPage.js"),
  catch: () => new DocsLoadFailed()
}))

/** Browsers retain failed imports; refreshing the atom cannot reset the document's module map. */
const retryDocsPageAtom = appRuntime.fn<void>()(() => BrowserWindow.reload)

const DocsRouteView = ({ route }: { readonly route: DocsRoute }) => {
  const page = useAtomValue(docsPageAtom)
  const retry = useAtomSet(retryDocsPageAtom)
  return Result.match(page, {
    onInitial: () => (
      <Layer className={appTheme.root}>
        <DocsHeader loading />
        <Main className={workbenchTheme.index}>
          <DocsStatus kind="index" state="loading" />
        </Main>
      </Layer>
    ),
    onFailure: () => (
      <Layer className={appTheme.root}>
        <DocsHeader />
        <Main className={workbenchTheme.index} data-route-focus tabIndex={-1}>
          <DocsStatus retry={retry} state="failure" />
        </Main>
      </Layer>
    ),
    onSuccess: ({ value: { DocsPage } }) => <DocsPage route={route} />
  })
}

const AppShell = () => {
  // Read, not mounted: the navigation atom must set the route during this render, before `pageRouteAtom` is read.
  useAtomValue(browserNavigationMountAtom)
  useAtomMount(browserMetadataMountAtom)
  useAtomMount(colorModeApplicationAtom)
  const route = useAtomValue(pageRouteAtom)

  return Match.value(route).pipe(
    Match.tag("HomeRoute", () => <HomePage />),
    Match.tag("DocsIndexRoute", (docsRoute) => <DocsRouteView route={docsRoute} />),
    Match.tag("DocsOverviewRoute", (docsRoute) => <DocsRouteView route={docsRoute} />),
    Match.tag("DocsGuideRoute", (docsRoute) => <DocsRouteView route={docsRoute} />),
    Match.tag("DocsApiRoute", (docsRoute) => <DocsRouteView route={docsRoute} />),
    Match.tag("DocsNotFoundRoute", (docsRoute) => <DocsRouteView route={docsRoute} />),
    Match.exhaustive
  )
}

/**
 * Motion is configured once: the theme's transition and the reader's motion
 * preference, read from `motionPreferenceAtom` so the page has one source for
 * it. The feature bundle loads lazily (`domAnimation`: values and presence;
 * nothing on the page animates layout, the drawing travels by its own
 * measured positions) and `strict` makes every animated element an `m`
 * element, so nothing bypasses this configuration.
 */
const MotionRoot = ({ children }: { readonly children: ReactNode }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig
      reducedMotion={motionConfigReducedMotion(useAtomValue(motionPreferenceAtom))}
      transition={themeTransition}
    >
      {children}
    </MotionConfig>
  </LazyMotion>
)

/**
 * The page is served under a policy that admits no inline style
 * (`security-headers.ts`), so Base UI is told to write no `<style>` elements:
 * the one rule its scroll areas would write, hiding the native scrollbar, is
 * in `styles.css` instead. Base UI tooltips share one provider so they hand
 * off without delay.
 */
export const App = () => (
  <RegistryProvider defaultIdleTTL={400}>
    <CSPProvider disableStyleElements>
      <MotionRoot>
        <Tooltip.Provider>
          <AppShell />
        </Tooltip.Provider>
      </MotionRoot>
    </CSPProvider>
  </RegistryProvider>
)
