import { GitHubStarButton } from "./GitHubStarButton.js"
import { headerChromeButtonClassName } from "./HeaderChrome.js"
import { Cluster, Header } from "./Layout.js"
import { InternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"
import { ThemeToggle } from "./ThemeToggle.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

const docsLinkClassName = headerChromeButtonClassName({
  active: false,
  className: "w-auto px-3"
})

export const SiteHeader = () => (
  <Header className="pb-2 pt-4">
    <Cluster className="items-center justify-between gap-4">
      <InternalLink href="/">
        <TheoriaLogo animation="glossary" className="text-2xl" />
      </InternalLink>
      <Cluster className="items-center gap-2">
        <InternalLink className={docsLinkClassName} href="/docs">
          <SemanticText as="span" role="button-label" text="Docs" variant="expanded" />
        </InternalLink>
        <GitHubStarButton />
        <ThemeToggle />
      </Cluster>
    </Cluster>
  </Header>
)
