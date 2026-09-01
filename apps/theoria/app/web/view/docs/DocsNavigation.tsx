import * as Arr from "effect/Array"

import type { DocsPackageSummary } from "@theoria/docs-model"
import type { DocsRoute } from "../../../contracts/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Nav, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { destinationIsActive, type DocsDestination, docsDestinationsFor } from "./docsModel.js"

const NavigationLink = ({
  active,
  destination,
  onNavigate
}: {
  readonly active: boolean
  readonly destination: DocsDestination
  readonly onNavigate?: () => void
}) => (
  <InternalLink
    aria-current={active ? "page" : undefined}
    className={`${docsTheme.navLink} ${active ? docsTheme.navLinkActive : ""}`}
    href={destination.href}
    onClick={onNavigate}
  >
    <SemanticText
      as="span"
      className="min-w-0 text-inherit"
      role="status"
      text={destination.label}
      variant="compact"
    />
  </InternalLink>
)

const NavigationGroup = ({
  destinations,
  group,
  onNavigate,
  route
}: {
  readonly destinations: ReadonlyArray<DocsDestination>
  readonly group: DocsDestination["group"]
  readonly onNavigate?: () => void
  readonly route: DocsRoute
}) => (
  <Stack className="gap-2">
    <SemanticText
      as="h2"
      className="px-3 text-ink-500"
      role="row-label"
      text={group}
      variant="expanded"
    />
    <Stack className="gap-1">
      {Arr.map(
        Arr.filter(destinations, (destination) => destination.group === group),
        (destination) => (
          <NavigationLink
            active={destinationIsActive(destination, route)}
            destination={destination}
            key={destination.href}
            {...(onNavigate === undefined ? {} : { onNavigate })}
          />
        )
      )}
    </Stack>
  </Stack>
)

export const DocsNavigation = ({
  docsPackage,
  onNavigate,
  route
}: {
  readonly docsPackage: DocsPackageSummary
  readonly onNavigate?: () => void
  readonly route: DocsRoute
}) => {
  const destinations = docsDestinationsFor(docsPackage)

  return (
    <Nav aria-label={`${docsPackage.name} documentation`}>
      <Stack className="gap-7">
        <NavigationGroup
          destinations={destinations}
          group="Guides"
          route={route}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
        <NavigationGroup
          destinations={destinations}
          group="API"
          route={route}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
      </Stack>
    </Nav>
  )
}
