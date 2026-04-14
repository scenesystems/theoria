import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import * as Arr from "effect/Array"

import { Cluster, Section, Stack } from "./Layout.js"
import { ExternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

// eslint-disable-next-line no-restricted-syntax -- static render-time constant, not a side effect
const COPYRIGHT_YEAR = new Date().getFullYear()

type FooterDestination = {
  readonly href: string
  readonly label: string
}

const footerDestinations: ReadonlyArray<FooterDestination> = [
  {
    href: "https://github.com/scenesystems/theoria",
    label: "GitHub"
  },
  {
    href: "https://scenesystems.io",
    label: "scenesystems.io"
  },
  {
    href: "https://x.com/scenesystems",
    label: "@scenesystems"
  }
]

const footerLinkClassName =
  "inline-flex min-w-0 items-center gap-1.5 text-ink-600 transition-colors duration-150 hover:text-ink-900"

const FooterLink = ({ destination }: { readonly destination: FooterDestination }) => (
  <ExternalLink className={footerLinkClassName} href={destination.href}>
    <SemanticText as="span" className="text-ink-700" role="status" text={destination.label} variant="compact" />
    <ArrowTopRightOnSquareIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-400" />
  </ExternalLink>
)

export const SiteFooter = () => (
  <Section as="footer" className="mt-10 border-t border-stage-200/90 pb-3 pt-4 md:pt-5">
    <Stack className="items-center gap-2 md:items-stretch">
      <Cluster className="items-baseline justify-center gap-x-3 gap-y-2 md:justify-between">
        <Cluster className="items-baseline gap-3">
          <TheoriaLogo animation="glossary" className="text-[1.45rem] md:text-[1.55rem]" />
          <SemanticText
            as="p"
            className="hidden text-ink-500 md:block"
            role="status"
            text="Observation that produces knowledge"
            variant="compact"
          />
        </Cluster>
        <Cluster as="nav" className="hidden gap-x-4 gap-y-2 md:flex">
          {Arr.map(
            footerDestinations,
            (destination) => <FooterLink destination={destination} key={destination.href} />
          )}
        </Cluster>
      </Cluster>

      <SemanticText
        as="p"
        className="text-ink-500 md:hidden"
        role="status"
        text="Observation that produces knowledge"
        variant="compact"
      />

      <Cluster as="nav" className="justify-center gap-x-4 gap-y-2 md:hidden">
        {Arr.map(
          footerDestinations,
          (destination) => <FooterLink destination={destination} key={destination.href} />
        )}
      </Cluster>

      <SemanticText
        as="p"
        className="text-center text-ink-500 md:text-left"
        role="status"
        text={`© ${COPYRIGHT_YEAR} Scene Systems`}
        variant="compact"
      />
    </Stack>
  </Section>
)
