import { CSPProvider } from "@base-ui/react/csp-provider"
import { Tooltip } from "@base-ui/react/tooltip"
import { RegistryProvider, useAtomMount, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import { domAnimation, LazyMotion, MotionConfig } from "motion/react"
import type { ReactNode } from "react"

import { motionConfigReducedMotion, motionPreferenceAtom } from "./atoms/motion.js"
import { browserMetadataMountAtom, browserNavigationMountAtom, pageRouteAtom } from "./atoms/navigation.js"
import { colorModeApplicationAtom } from "./atoms/theme.js"
import { DocsPage } from "./view/docs/DocsPage.js"
import { HomePage } from "./view/home/HomePage.js"
import { themeTransition } from "./view/primitives/motion.js"

import "./styles.css"

const AppShell = () => {
  // Read, not mounted: the navigation atom must set the route during this render, before `pageRouteAtom` is read.
  useAtomValue(browserNavigationMountAtom)
  useAtomMount(browserMetadataMountAtom)
  useAtomMount(colorModeApplicationAtom)
  const route = useAtomValue(pageRouteAtom)

  return Match.value(route).pipe(
    Match.tag("HomeRoute", () => <HomePage />),
    Match.tag("DocsIndexRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsOverviewRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsGuideRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsApiRoute", (docsRoute) => <DocsPage route={docsRoute} />),
    Match.tag("DocsNotFoundRoute", (docsRoute) => <DocsPage route={docsRoute} />),
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
