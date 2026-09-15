import { Button } from "@base-ui/react/button"
import { useAtomSet } from "@effect-atom/atom-react"
import { Bars3Icon } from "@heroicons/react/20/solid"
import { Boolean as Bool, Option } from "effect"

import type { DocsPackageSummary } from "@theoria/docs-model"
import { setDocsNavigationOpenAtom } from "../../atoms/docs.js"
import { focusClassName, iconButtonClassName, workbenchTheme } from "../primitives/designSystem.js"
import { headerChromeClassName } from "../primitives/HeaderChrome.js"
import { Cluster, Header, Layer } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"
import { ThemeToggle } from "../primitives/ThemeToggle.js"
import { TheoriaLogo } from "../primitives/TheoriaLogo.js"
import { DocsPackagePicker } from "./DocsPackagePicker.js"
import { DocsSearchTrigger } from "./DocsSearchDialog.js"

export const DocsHeader = ({
  activePackage,
  loading = false,
  packages
}: {
  readonly activePackage: Option.Option<DocsPackageSummary>
  readonly loading?: boolean
  readonly packages: ReadonlyArray<DocsPackageSummary>
}) => {
  const setNavigationOpen = useAtomSet(setDocsNavigationOpenAtom)

  return (
    <Header className={headerChromeClassName("workbench")}>
      <Cluster className={workbenchTheme.headerContent}>
        <Cluster className="min-w-0 shrink-0 gap-3">
          {Option.match(activePackage, {
            onNone: () => null,
            onSome: () => (
              <Button
                aria-label="Open navigation"
                className={`${iconButtonClassName} lg:hidden`}
                onClick={() => setNavigationOpen(true)}
                type="button"
              >
                <Bars3Icon aria-hidden className="h-5 w-5" />
              </Button>
            )
          })}
          <InternalLink
            aria-label="Theoria home"
            className={`inline-flex min-w-0 items-baseline text-ink ${focusClassName}`}
            href="/"
          >
            <TheoriaLogo className="text-[1.55rem] sm:text-[1.7rem]" />
          </InternalLink>
          <Layer className="hidden h-5 w-px bg-hairline-strong sm:block" />
          <InternalLink
            aria-label="Documentation home"
            className={`hidden text-ink-tertiary ${focusClassName} hover:text-ink sm:inline-flex`}
            href="/docs"
          >
            <SemanticText as="span" className="text-inherit" role="status" text="Docs" variant="compact" />
          </InternalLink>
        </Cluster>
        <Layer className="hidden min-w-0 flex-1 justify-center lg:flex">
          {Bool.match(loading, {
            onTrue: () => <ShimmerLine className="h-11 rounded-instrument" width="w-72" />,
            onFalse: () => <DocsPackagePicker activePackage={activePackage} packages={packages} />
          })}
        </Layer>
        <Cluster className="min-w-0 shrink-0 justify-end gap-2">
          {Bool.match(loading, {
            onTrue: () => <ShimmerLine className="hidden h-11 rounded-instrument sm:block" width="w-40" />,
            onFalse: () => <DocsSearchTrigger />
          })}
          <ThemeToggle />
        </Cluster>
      </Cluster>
    </Header>
  )
}
