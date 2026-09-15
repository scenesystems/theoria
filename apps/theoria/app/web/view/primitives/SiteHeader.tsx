import { useAtomSet } from "@effect-atom/atom-react"
import { BookOpenIcon } from "@heroicons/react/20/solid"

import { wordmarkPhaseAtom } from "../../atoms/wordmark.js"
import { GitHubMark } from "./BrandMarks.js"
import { headerChromeClassName, headerChromeGlyphClassName, headerChromeLinkClassName } from "./HeaderChrome.js"
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
export const SiteHeader = () => {
  const tellWordmark = useAtomSet(wordmarkPhaseAtom)

  return (
    <Header className={headerChromeClassName("floating")}>
      <Cluster className="justify-between gap-4">
        {/* Reaching the wordmark by keyboard meets it the way a pointer does. */}
        <InternalLink href="/" onFocus={() => tellWordmark("replayAsked")}>
          <TheoriaLogo animation="glossary" />
        </InternalLink>
        {/* The gap keeps neighbouring 44px hit areas from overlapping when only glyphs show. */}
        <Cluster render={<nav aria-label="Site" />} className="gap-4">
          <InternalLink aria-label="Docs" className={headerChromeLinkClassName()} href="/docs">
            <BookOpenIcon aria-hidden className={headerChromeGlyphClassName("heroicon-20-solid")} />
            <SemanticText
              as="span"
              className="hidden text-inherit sm:inline"
              role="button-label"
              text="Docs"
              variant="expanded"
            />
          </InternalLink>
          <ExternalLink
            aria-label="Theoria on GitHub"
            className={headerChromeLinkClassName()}
            href={theoriaRepoUrl}
          >
            <GitHubMark className={headerChromeGlyphClassName("brand-mark")} />
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
}
