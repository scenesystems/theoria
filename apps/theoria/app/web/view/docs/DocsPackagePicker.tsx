import { Menu } from "@base-ui/react/menu"
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { Boolean as Bool, Equal, Option } from "effect"
import * as Arr from "effect/Array"

import type { DocsPackageSummary } from "@theoria/docs-model"
import {
  elevationClassName,
  menuItemClassName,
  menuPopupClassName,
  pickerTriggerClassName
} from "../primitives/designSystem.js"
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
      className={`${pickerTriggerClassName} w-full justify-between lg:w-[18rem]`}
    >
      <SemanticText
        as="span"
        className="min-w-0 truncate text-ink"
        role="button-label"
        text={Option.match(activePackage, { onNone: () => "Packages", onSome: (value) => value.name })}
        variant="compact"
      />
      <ChevronDownIcon aria-hidden className="h-4 w-4 shrink-0 text-ink-tertiary" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner
        align="start"
        className={elevationClassName("menu")}
        collisionPadding={16}
        positionMethod="fixed"
        sideOffset={8}
      >
        <Menu.Popup
          className={`max-h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] ${menuPopupClassName}`}
        >
          {Arr.map(packages, (docsPackage) => {
            const active = Option.exists(activePackage, (value) => Equal.equals(docsPackage.slug, value.slug))

            return (
              <Menu.Item
                closeOnClick
                key={docsPackage.slug}
                render={
                  <InternalLink
                    className={menuItemClassName}
                    href={docsPackage.overview.path}
                    onClick={onNavigate}
                  />
                }
              >
                <CheckIcon
                  aria-hidden
                  className={`h-4 w-4 shrink-0 ${
                    Bool.match(active, { onTrue: () => "text-ink opacity-100", onFalse: () => "opacity-0" })
                  }`}
                />
                <SemanticText
                  as="span"
                  className="min-w-0 truncate text-ink"
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
