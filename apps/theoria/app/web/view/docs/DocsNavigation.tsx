import { CheckIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import type { DocsSection } from "../../../contracts/docs.js"
import { docsTheme } from "../primitives/docsSystem.js"
import { Nav, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { DocsDestination } from "./docsModel.js"

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
    <CheckIcon
      aria-hidden
      className={`mt-0.5 h-4 w-4 shrink-0 transition-opacity ${active ? "text-ink-900 opacity-100" : "opacity-0"}`}
    />
    <SemanticText
      as="span"
      className="min-w-0 text-ink-900"
      role="button-label"
      text={destination.label}
      variant="compact"
    />
  </InternalLink>
)

export const DocsNavigation = ({
  activeSection,
  destinations,
  label,
  onNavigate
}: {
  readonly activeSection: DocsSection
  readonly destinations: ReadonlyArray<DocsDestination>
  readonly label: string
  readonly onNavigate?: () => void
}) => (
  <Nav aria-label={label}>
    <Stack className="gap-1">
      {Arr.map(destinations, (destination) => (
        <NavigationLink
          active={destination.section === activeSection}
          destination={destination}
          key={destination.href}
          {...(onNavigate === undefined ? {} : { onNavigate })}
        />
      ))}
    </Stack>
  </Nav>
)
