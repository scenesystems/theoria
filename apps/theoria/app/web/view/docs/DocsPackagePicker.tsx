import { Menu } from "@base-ui-components/react/menu"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import type { DocsPackageSummary } from "@theoria/docs-model"
import { docsTheme } from "../primitives/docsSystem.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const DocsPackagePicker = ({
  activePackage,
  onNavigate,
  packages
}: {
  readonly activePackage: DocsPackageSummary | null
  readonly onNavigate?: () => void
  readonly packages: ReadonlyArray<DocsPackageSummary>
}) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label="Choose package"
      className={`${docsTheme.searchTrigger} w-full justify-between lg:w-[18rem]`}
    >
      <SemanticText
        as="span"
        className="min-w-0 truncate text-ink-900"
        role="button-label"
        text={activePackage?.name ?? "Packages"}
        variant="compact"
      />
      <ChevronDownIcon aria-hidden className="h-4 w-4 shrink-0 text-ink-500" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner align="start" className="z-[100]" sideOffset={8}>
        <Menu.Popup className="w-[min(24rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-2xl border border-stage-300/90 bg-stage-0/98 p-2 shadow-hero ring-1 ring-stage-0/70 transition-[opacity,transform] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {Arr.map(packages, (docsPackage) => {
            const active = docsPackage.slug === activePackage?.slug

            return (
              <Menu.Item
                closeOnClick
                key={docsPackage.slug}
                render={
                  <InternalLink
                    className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-ink-700 outline-none hover:bg-stage-100/80 focus:bg-stage-100/80"
                    href={docsPackage.overview.path}
                    onClick={onNavigate}
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
                  text={docsPackage.name}
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
