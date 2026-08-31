import { Menu } from "@base-ui-components/react/menu"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Card } from "../../../contracts/card.js"
import { docsOverviewRoute, DocsPackageSlug, docsPathFor } from "../../../contracts/docs.js"
import { docsPackageMenuOpenAtom, setDocsPackageMenuOpenAtom } from "../../atoms/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const DocsPackagePicker = ({
  activeCard,
  cards
}: {
  readonly activeCard: Card
  readonly cards: ReadonlyArray<Card>
}) => {
  const open = useAtomValue(docsPackageMenuOpenAtom)
  const setOpen = useAtomSet(setDocsPackageMenuOpenAtom)
  const isDocsPackageSlug = Schema.is(DocsPackageSlug)
  const destinations = Arr.filterMap(cards, (card) =>
    isDocsPackageSlug(card.id)
      ? Option.some({ card, packageSlug: card.id })
      : Option.none())

  return (
    <Menu.Root onOpenChange={setOpen} open={open}>
      <Menu.Trigger
        aria-label="Choose documentation package"
        className={`${docsTheme.searchTrigger} w-full justify-between lg:w-[15rem]`}
      >
        <Stack className="min-w-0 gap-0 text-left">
          <SemanticText
            as="span"
            className="text-ink-500"
            role="row-label"
            text="Package"
            variant="compact"
          />
          <SemanticText
            as="span"
            className="truncate text-ink-900"
            role="button-label"
            text={activeCard.title}
            variant="compact"
          />
        </Stack>
        <ChevronDownIcon aria-hidden className="h-4 w-4 shrink-0 text-ink-500" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" className="z-[70]" sideOffset={8}>
          <Menu.Popup className="w-[min(22rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-2xl border border-stage-300/90 bg-stage-0/98 p-2 shadow-hero ring-1 ring-stage-0/70 transition-[opacity,transform] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Layer className="px-3 pb-2 pt-1">
              <SemanticText
                as="p"
                className="text-ink-500"
                role="row-label"
                text="Theoria packages"
                variant="expanded"
              />
            </Layer>
            {Arr.map(destinations, ({ card, packageSlug }) => {
              const active = card.id === activeCard.id

              return (
                <Menu.Item
                  closeOnClick
                  key={card.id}
                  render={
                    <InternalLink
                      className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-ink-700 outline-none hover:bg-stage-100/80 focus:bg-stage-100/80"
                      href={docsPathFor(docsOverviewRoute(packageSlug))}
                    />
                  }
                >
                  <CheckIcon
                    aria-hidden
                    className={`h-4 w-4 shrink-0 ${active ? "text-ink-900 opacity-100" : "opacity-0"}`}
                  />
                  <SemanticText
                    as="span"
                    className="min-w-0 truncate text-ink-900"
                    role="button-label"
                    text={card.title}
                    variant="compact"
                  />
                </Menu.Item>
              )
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
