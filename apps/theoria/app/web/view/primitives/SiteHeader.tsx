import { GitHubStarButton } from "./GitHubStarButton.js"
import { Cluster, Header } from "./Layout.js"
import { InternalLink } from "./Link.js"
import { ThemeToggle } from "./ThemeToggle.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

export const SiteHeader = () => (
  <Header className="pb-2 pt-4">
    <Cluster className="items-center justify-between gap-4">
      <InternalLink href="/">
        <TheoriaLogo animation="glossary" className="text-2xl" />
      </InternalLink>
      <Cluster className="items-center gap-2">
        <GitHubStarButton />
        <ThemeToggle />
      </Cluster>
    </Cluster>
  </Header>
)
