import { GitHubMark } from "./BrandMarks.js"
import { headerChromeGlyphClassName, headerChromeLinkClassName } from "./HeaderChrome.js"
import { Cluster, Header } from "./Layout.js"
import { ExternalLink, InternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"
import { ThemeToggle } from "./ThemeToggle.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

const theoriaRepoUrl = "https://github.com/scenesystems/theoria"

/**
 * The wordmark and three ways off the page — the docs, the repository, the
 * other theme — set as words and a glyph on the canvas. Nothing here is a
 * chip: the header is the first thing that says the page is not a card.
 */
export const SiteHeader = () => (
  <Header className="pb-2 pt-2">
    <Cluster className="items-center justify-between gap-4">
      <InternalLink href="/">
        <TheoriaLogo animation="glossary" className="text-2xl" />
      </InternalLink>
      <Cluster render={<nav aria-label="Site" />} className="items-center gap-1 sm:gap-3">
        <InternalLink className={headerChromeLinkClassName()} href="/docs">
          <SemanticText as="span" className="text-inherit" role="button-label" text="Docs" variant="expanded" />
        </InternalLink>
        <ExternalLink
          aria-label="Theoria on GitHub"
          className={headerChromeLinkClassName()}
          href={theoriaRepoUrl}
        >
          <GitHubMark className={headerChromeGlyphClassName} />
          <SemanticText
            as="span"
            className="hidden text-inherit sm:inline"
            role="button-label"
            text="GitHub"
            variant="expanded"
          />
        </ExternalLink>
        <ThemeToggle />
      </Cluster>
    </Cluster>
  </Header>
)
