import { Collapsible } from "@base-ui-components/react/collapsible"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import type { DocsPackageSummary } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Layer, Nav, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import {
  destinationIsActive,
  type DocsDestination,
  type DocsNavigationBranch,
  docsNavigationBranchesFor
} from "./docsModel.js"

const NavigationLink = ({
  active,
  child,
  destination,
  onNavigate
}: {
  readonly active: boolean
  readonly child?: boolean
  readonly destination: DocsDestination
  readonly onNavigate?: () => void
}) => (
  <InternalLink
    aria-current={active ? "page" : undefined}
    className={child
      ? `${docsTheme.navChildLink} ${active ? docsTheme.navChildLinkActive : ""}`
      : `${docsTheme.navLink} ${active ? docsTheme.navLinkActive : ""}`}
    href={destination.href}
    onClick={onNavigate}
  >
    <SemanticText as="span" className="min-w-0 text-inherit" role="status" text={destination.label} variant="compact" />
  </InternalLink>
)

const NavigationBranch = ({
  branch,
  onNavigate,
  route
}: {
  readonly branch: DocsNavigationBranch
  readonly onNavigate?: () => void
  readonly route: DocsRoute
}) => {
  const active = destinationIsActive(branch.root, route) ||
    Arr.some(branch.children, (destination) => destinationIsActive(destination, route))
  const branchContent = (
    <Stack className="ml-3 mt-1 gap-1 border-l border-stage-300/80 pl-3">
      {Arr.map(branch.children, (destination) => (
        <NavigationLink
          active={destinationIsActive(destination, route)}
          child
          destination={destination}
          key={destination.href}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
      ))}
    </Stack>
  )

  return (
    <Stack className="gap-2">
      <SemanticText as="h2" className="px-3 text-ink-500" role="row-label" text={branch.label} variant="expanded" />
      {branch.children.length === 0 ?
        (
          <NavigationLink
            active={destinationIsActive(branch.root, route)}
            destination={branch.root}
            {...(onNavigate === undefined ? {} : { onNavigate })}
          />
        ) :
        (
          <Collapsible.Root defaultOpen={active} key={`${branch.root.href}:${String(active)}`}>
            <Layer className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-1">
              <NavigationLink
                active={destinationIsActive(branch.root, route)}
                destination={branch.root}
                {...(onNavigate === undefined ? {} : { onNavigate })}
              />
              <Collapsible.Trigger
                aria-label={`Toggle ${branch.label.toLocaleLowerCase("en-US")} navigation`}
                className="group mt-0.5 inline-flex size-10 items-center justify-center rounded-xl text-ink-500 outline-none transition-colors hover:bg-stage-0/80 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/20"
              >
                <ChevronRightIcon
                  aria-hidden
                  className="size-4 transition-transform duration-150 group-data-[panel-open]:rotate-90"
                />
              </Collapsible.Trigger>
            </Layer>
            <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-150 data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0">
              {branchContent}
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
    </Stack>
  )
}

export const DocsNavigation = ({
  docsPackage,
  onNavigate,
  route
}: {
  readonly docsPackage: DocsPackageSummary
  readonly onNavigate?: () => void
  readonly route: DocsRoute
}) => {
  const branches = docsNavigationBranchesFor(docsPackage)

  return (
    <Nav aria-label={`${docsPackage.name} documentation`}>
      <Stack className="gap-7">
        {Arr.map(branches, (branch) => (
          <NavigationBranch
            branch={branch}
            key={branch.label}
            route={route}
            {...(onNavigate === undefined ? {} : { onNavigate })}
          />
        ))}
      </Stack>
    </Nav>
  )
}
