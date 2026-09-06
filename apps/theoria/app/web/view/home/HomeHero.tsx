import { ArrowDownIcon } from "@heroicons/react/20/solid"

import { primaryActionClassName, textActionClassName } from "../primitives/ActionButton.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { AnchorLink, InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

/** The demo section's anchor; the hero's second action lands the visitor on the place. */
export const imaginedPlaceSectionId = "imagined-place"

/**
 * The hero says what Theoria is, once, in display type on the bare canvas.
 * Two ways onward: the packages, or the place the demonstration built.
 */
export const HomeHero = () => (
  <Section className="pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-24 lg:pb-28" data-home-hero>
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
        <AnchorLink className={textActionClassName} href={`#${imaginedPlaceSectionId}`}>
          <SemanticText as="span" className="text-inherit" role="button-label" text="See the place it built" />
          <ArrowDownIcon aria-hidden className="size-4" />
        </AnchorLink>
      </Cluster>
    </Stack>
  </Section>
)
