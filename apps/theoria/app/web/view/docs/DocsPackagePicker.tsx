import { Menu } from "@base-ui/react/menu"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
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
  readonly activePackage: Option.Option<DocsPackageSummary>
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
        text={Option.match(activePackage, { onNone: () => "Packages", onSome: (value) => value.name })}
        variant="compact"
      />
      <ChevronDownIcon aria-hidden className="h-4 w-4 shrink-0 text-ink-500" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner
        align="start"
        className="z-[100]"
        collisionPadding={16}
        positionMethod="fixed"
        sideOffset={8}
      >
        <Menu.Popup className="max-h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-2xl border border-stage-300/90 bg-stage-0 p-2 shadow-hero ring-1 ring-stage-0/70 transition-[opacity,transform] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          {Arr.map(packages, (docsPackage) => {
            const active = Option.exists(activePackage, (value) => docsPackage.slug === value.slug)

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
