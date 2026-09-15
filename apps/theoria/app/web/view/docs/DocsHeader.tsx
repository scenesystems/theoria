import { Button } from "@base-ui/react/button"
import { useAtomSet } from "@effect-atom/atom-react"
import { Bars3Icon } from "@heroicons/react/20/solid"
import { Boolean as Bool } from "effect"

import { siteMetadata } from "../../../contracts/metadata.js"
import { setDocsNavigationOpenAtom } from "../../atoms/docs.js"
import { GitHubMark } from "../primitives/BrandMarks.js"
import { focusClassName, workbenchTheme } from "../primitives/designSystem.js"
import {
  headerChromeBrandLinkClassName,
  headerChromeClassName,
  headerChromeGlyphClassName,
  headerChromeIconButtonClassName,
  headerChromeLinkClassName
} from "../primitives/HeaderChrome.js"
import { Cluster, Header, Layer } from "../primitives/Layout.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ShimmerLine } from "../primitives/Skeleton.js"
import { ThemeToggle } from "../primitives/ThemeToggle.js"
import { TheoriaLogo } from "../primitives/TheoriaLogo.js"
import { DocsSearchTrigger } from "./DocsSearchDialog.js"

export const DocsHeader = ({
  loading = false,
  navigation = false
}: {
  readonly loading?: boolean
  readonly navigation?: boolean
}) => {
  const setNavigationOpen = useAtomSet(setDocsNavigationOpenAtom)

  return (
    <Header className={headerChromeClassName("workbench")}>
      <Cluster className={workbenchTheme.headerContent}>
        <Cluster className="min-w-0 shrink-0 gap-4">
          {Bool.match(navigation, {
            onFalse: () => null,
            onTrue: () => (
              <Button
                aria-label="Open navigation"
                className={headerChromeIconButtonClassName("lg:hidden")}
                onClick={() => setNavigationOpen(true)}
                type="button"
              >
                <Bars3Icon aria-hidden className={headerChromeGlyphClassName("heroicon-20-solid")} />
              </Button>
            )
          })}
          <InternalLink
            aria-label="Theoria home"
            className={headerChromeBrandLinkClassName}
            href="/"
          >
            <TheoriaLogo animation="none" variant="responsive" />
          </InternalLink>
          <Layer className="hidden h-5 w-px bg-hairline-strong sm:block" />
          <InternalLink
            aria-label="Documentation home"
            className={`hidden text-ink-tertiary ${focusClassName} hover:text-ink sm:inline-flex`}
            href="/docs"
          >
            <SemanticText as="span" role="row-value" text="Docs" variant="compact" />
          </InternalLink>
        </Cluster>
        <Cluster className="min-w-0 shrink-0 justify-end gap-4">
          {Bool.match(loading, {
            onTrue: () => <ShimmerLine className="hidden h-11 rounded-instrument sm:block" width="w-40" />,
            onFalse: () => <DocsSearchTrigger />
          })}
          <ExternalLink
            aria-label="Theoria on GitHub"
            className={headerChromeLinkClassName()}
            href={siteMetadata.repositoryUrl}
          >
            <GitHubMark className={headerChromeGlyphClassName("brand-mark")} />
          </ExternalLink>
          <ThemeToggle />
        </Cluster>
      </Cluster>
    </Header>
  )
}
