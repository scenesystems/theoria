import { ArrowDownIcon } from "@heroicons/react/20/solid"

import { primaryActionClassName, textActionClassName } from "../primitives/ActionButton.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { AnchorLink, InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

/** The demo section's anchor. */
export const imaginedPlaceSectionId = "imagined-place"

/** The How it's built section's anchor; the hero's second action lands the visitor there. */
export const howItsBuiltSectionId = "how-its-built"

/** The hero's second action, by name: what the tests reach it by. */
export const howItsBuiltActionLabel = "See how it's built"

/**
 * The hero says what Theoria is, once, in display type on the bare canvas.
 * Two ways onward: the packages, or how the demonstration beside it is
 * built. The demonstration itself is already in view, so the hero does not
 * point at it.
 */
export const HomeHero = () => (
  <Section className="pt-hero-lead pb-hero-trail" data-home-hero>
    <Stack className="gap-6 sm:gap-8">
      <SemanticText
        as="h1"
        className="text-balance text-ink-950"
        role="display"
        text="Scientific computing and model programming with Effect"
        variant="expanded"
        wrapAuthority="native-browser"
      />
      <SemanticText
        as="p"
        className="text-ink-700"
        role="lead"
        text="Theoria is an open-source collection of TypeScript libraries for reproducible computational work in Effect applications."
        variant="expanded"
        wrapAuthority="native-browser"
      />
      <Cluster className="items-center gap-x-3 gap-y-2 pt-1">
        <InternalLink className={primaryActionClassName} href="/docs">
          <SemanticText as="span" className="text-stage-0" role="button-label" text="Browse the packages" />
        </InternalLink>
        <AnchorLink className={textActionClassName} href={`#${howItsBuiltSectionId}`}>
          <SemanticText as="span" className="text-inherit" role="button-label" text={howItsBuiltActionLabel} />
          <ArrowDownIcon aria-hidden className="size-4" />
        </AnchorLink>
      </Cluster>
    </Stack>
  </Section>
)
