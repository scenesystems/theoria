import { useAtomValue } from "@effect-atom/atom-react"
import { Option } from "effect"
import * as Arr from "effect/Array"

import type { Card } from "../../../contracts/card.js"
import { type DocsRoute, docsSectionFor } from "../../../contracts/docs.js"
import { docsKeyboardShortcutsAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Main, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { DocsContent } from "./DocsContent.js"
import { DocsHeader } from "./DocsHeader.js"
import { docsDestinationsFor, docsPageCopyFor } from "./docsModel.js"
import { DocsNavigation } from "./DocsNavigation.js"
import { DocsNavigationDrawer } from "./DocsNavigationDrawer.js"
import { DocsOnThisPage } from "./DocsOnThisPage.js"
import { DocsSearchDialog } from "./DocsSearchDialog.js"

const MissingPackage = () => (
  <Main className="mx-auto min-h-dvh max-w-3xl px-5 py-20">
    <Stack className="gap-3">
      <SemanticText
        as="h1"
        className="text-ink-950"
        role="hero-title"
        text="Documentation package unavailable"
        variant="expanded"
      />
      <SemanticText
        as="p"
        className="text-ink-600"
        role="card-summary"
        text="The requested package is public, but its package metadata could not be loaded."
        variant="expanded"
        wrapAuthority="native-browser"
      />
    </Stack>
  </Main>
)

const DocsShell = ({
  activeCard,
  cards,
  route
}: {
  readonly activeCard: Card
  readonly cards: ReadonlyArray<Card>
  readonly route: DocsRoute
}) => {
  const destinations = docsDestinationsFor(route)
  const copy = docsPageCopyFor(route, activeCard)
  const activeSection = docsSectionFor(route)

  return (
    <Layer className={docsTheme.root}>
      <DocsHeader activeCard={activeCard} cards={cards} />
      <Layer className={docsTheme.workbench}>
        <Section as="aside" className={docsTheme.sidebar}>
          <Stack className={docsTheme.sidebarSticky}>
            <DocsNavigation
              activeSection={activeSection}
              destinations={destinations}
              label="Documentation"
            />
          </Stack>
        </Section>
        <Main className={docsTheme.main}>
          <Layer className={docsTheme.article}>
            <DocsContent card={activeCard} copy={copy} route={route} />
          </Layer>
        </Main>
        <Section as="aside" className={docsTheme.toc}>
          <Layer className={docsTheme.tocSticky}>
            <DocsOnThisPage card={activeCard} route={route} />
          </Layer>
        </Section>
      </Layer>
      <DocsNavigationDrawer
        activeCard={activeCard}
        activeSection={activeSection}
        cards={cards}
        destinations={destinations}
      />
      <DocsSearchDialog destinations={destinations} />
    </Layer>
  )
}

export const DocsPage = ({
  cards,
  route
}: {
  readonly cards: ReadonlyArray<Card>
  readonly route: DocsRoute
}) => {
  useAtomValue(docsKeyboardShortcutsAtom)
  const card = Arr.findFirst(cards, (candidate) => candidate.id === route.packageSlug)

  return (
    <Layer>
      {Option.match(card, {
        onNone: MissingPackage,
        onSome: (activeCard) => <DocsShell activeCard={activeCard} cards={cards} route={route} />
      })}
    </Layer>
  )
}
