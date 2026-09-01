import { Button } from "@base-ui-components/react/button"
import { useAtomSet } from "@effect-atom/atom-react"
import { Bars3Icon } from "@heroicons/react/20/solid"

import type { Card } from "../../../contracts/card.js"
import { setDocsNavigationOpenAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Cluster, Header, Layer } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ThemeToggle } from "../primitives/ThemeToggle.js"
import { TheoriaLogo } from "../primitives/TheoriaLogo.js"
import { DocsPackagePicker } from "./DocsPackagePicker.js"
import { DocsSearchTrigger } from "./DocsSearchDialog.js"

export const DocsHeader = ({
  activeCard,
  cards
}: {
  readonly activeCard: Card
  readonly cards: ReadonlyArray<Card>
}) => {
  const setNavigationOpen = useAtomSet(setDocsNavigationOpenAtom)

  return (
    <Header className={docsTheme.header}>
      <Cluster className={docsTheme.headerContent}>
        <Cluster className="min-w-0 shrink-0 gap-3">
          <Button
            aria-label="Open documentation navigation"
            className={`${docsTheme.iconButton} lg:hidden`}
            onClick={() => setNavigationOpen(true)}
            type="button"
          >
            <Bars3Icon aria-hidden className="h-5 w-5" />
          </Button>
          <InternalLink
            aria-label="Theoria home"
            className="inline-flex min-w-0 items-baseline text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"
            href="/"
          >
            <TheoriaLogo className="text-[1.55rem] sm:text-[1.7rem]" />
          </InternalLink>
          <Layer className="hidden h-5 w-px bg-stage-300 sm:block" />
          <InternalLink
            aria-label="Documentation home"
            className="hidden text-ink-600 outline-none hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/20 sm:inline-flex"
            href="/docs"
          >
            <SemanticText
              as="span"
              className="text-inherit"
              role="status"
              text="Docs"
              variant="compact"
            />
          </InternalLink>
        </Cluster>

        <Layer className="hidden min-w-0 flex-1 justify-center lg:flex">
          <DocsPackagePicker activeCard={activeCard} cards={cards} />
        </Layer>

        <Cluster className="min-w-0 shrink-0 justify-end gap-2">
          <DocsSearchTrigger />
          <ThemeToggle />
        </Cluster>
      </Cluster>
    </Header>
  )
}
