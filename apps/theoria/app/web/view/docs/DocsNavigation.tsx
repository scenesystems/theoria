import { Collapsible } from "@base-ui/react/collapsible"
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Boolean as Bool } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import type { DocsPackageSummary } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import {
  focusClassName,
  respondColorsClassName,
  stillUnderReducedMotion,
  transitionClassName,
  workbenchNavLinkClassName
} from "../primitives/designSystem.js"
import { Layer, Nav, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import {
  destinationIsActive,
  type DocsDestination,
  type DocsNavigationBranch,
  docsNavigationBranchesFor
} from "./docsModel.js"

const NavigationLink = ({
  active,
  child = false,
  destination,
  onNavigate
}: {
  readonly active: boolean
  readonly child?: boolean
  readonly destination: DocsDestination
  readonly onNavigate: () => void
}) => (
  <InternalLink
    aria-current={Bool.match(active, { onTrue: () => "page", onFalse: () => undefined })}
    className={workbenchNavLinkClassName({ active, child })}
    href={destination.href}
    onClick={onNavigate}
  >
    <SemanticContent as="span" className="min-w-0 wrap-anywhere" role="row-value" variant="compact">
      {destination.label}
    </SemanticContent>
  </InternalLink>
)

const NavigationBranch = ({
  branch,
  onNavigate,
  route
}: {
  readonly branch: DocsNavigationBranch
  readonly onNavigate: () => void
  readonly route: DocsRoute
}) => {
  const active = Bool.or(
    destinationIsActive(branch.root, route),
    Arr.some(branch.children, (destination) => destinationIsActive(destination, route))
  )
  const branchContent = (
    <Stack className="ml-3 mt-1 gap-1 border-l border-hairline-strong-glass pl-3">
      {Arr.map(branch.children, (destination) => (
        <NavigationLink
          active={destinationIsActive(destination, route)}
          child
          destination={destination}
          key={destination.href}
          onNavigate={onNavigate}
        />
      ))}
    </Stack>
  )

  return (
    <Stack className="gap-2">
      <SemanticText
        as="h2"
        className="px-3"
        role="row-label"
        text={branch.label}
        variant="expanded"
      />
      {Arr.match(branch.children, {
        onEmpty: () => (
          <NavigationLink
            active={destinationIsActive(branch.root, route)}
            destination={branch.root}
            onNavigate={onNavigate}
          />
        ),
        onNonEmpty: () => (
          <Collapsible.Root defaultOpen={active} key={`${branch.root.href}:${String(active)}`}>
            <Layer className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-1">
              <NavigationLink
                active={destinationIsActive(branch.root, route)}
                destination={branch.root}
                onNavigate={onNavigate}
              />
              <Collapsible.Trigger
                aria-label={`Toggle ${Str.toLocaleLowerCase("en-US")(branch.label)} navigation`}
                className={`group mt-0.5 inline-flex size-10 items-center justify-center rounded-instrument text-ink-tertiary ${respondColorsClassName} hover:bg-paper-glass hover:text-ink ${focusClassName}`}
              >
                <ChevronRightIcon
                  aria-hidden
                  className={`size-4 transition-transform ${
                    transitionClassName("respond")
                  } group-data-[panel-open]:rotate-90 ${stillUnderReducedMotion}`}
                />
              </Collapsible.Trigger>
            </Layer>
            <Collapsible.Panel
              className={`h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] ${
                transitionClassName("enter")
              } data-[ending-style]:h-0 data-[ending-style]:opacity-0 data-[starting-style]:h-0 data-[starting-style]:opacity-0 ${stillUnderReducedMotion}`}
            >
              {branchContent}
            </Collapsible.Panel>
          </Collapsible.Root>
        )
      })}
    </Stack>
  )
}

export const DocsNavigation = ({
  docsPackage,
  onNavigate = () => {},
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
            onNavigate={onNavigate}
          />
        ))}
      </Stack>
    </Nav>
  )
}
