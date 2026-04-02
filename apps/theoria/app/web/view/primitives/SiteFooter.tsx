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
  <Section as="footer" className="mt-10 border-t border-stage-200/90 pb-3 pt-4 sm:pt-5">
    <Cluster className="items-start justify-between gap-x-6 gap-y-3">
      <Stack className="gap-1">
        <TheoriaLogo className="text-[1.45rem] sm:text-[1.55rem]" />
        <SemanticText
          as="p"
          className="text-ink-500"
          role="status"
          text={`© ${COPYRIGHT_YEAR} Scene Systems`}
          variant="compact"
        />
      </Stack>

      <Cluster as="nav" className="gap-x-4 gap-y-2 sm:justify-end">
        {Arr.map(
          footerDestinations,
          (destination) => <FooterLink destination={destination} key={destination.href} />
        )}
      </Cluster>
    </Cluster>
  </Section>
)
