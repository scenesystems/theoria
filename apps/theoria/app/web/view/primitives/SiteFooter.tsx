import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Schema } from "effect"
import * as Arr from "effect/Array"

import { siteMetadata } from "../../../contracts/metadata.js"
import { respondColorsClassName } from "./designSystem.js"
import { Cluster, Section, Stack } from "./Layout.js"
import { ExternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"
import { TheoriaLogo } from "./TheoriaLogo.js"

const FooterDestination = Schema.Struct({
  href: Schema.String,
  label: Schema.String
})
type FooterDestination = typeof FooterDestination.Type

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
  `inline-flex min-w-0 items-center gap-1.5 text-ink-tertiary ${respondColorsClassName} hover:text-ink`

const FooterLink = ({ destination }: { readonly destination: FooterDestination }) => (
  <ExternalLink className={footerLinkClassName} href={destination.href}>
    <SemanticText as="span" className="text-ink-secondary" role="status" text={destination.label} variant="compact" />
    <ArrowTopRightOnSquareIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
  </ExternalLink>
)

export const SiteFooter = () => (
  <Section
    render={<footer />}
    className="mt-region border-t border-hairline-veil pb-3 pt-4 md:pt-5"
    data-site-footer
  >
    <Stack className="items-center gap-2 md:items-stretch">
      <Cluster align="baseline" className="justify-center gap-x-3 gap-y-2 md:justify-between">
        <Cluster align="baseline" className="gap-3">
          <TheoriaLogo animation="glossary" className="text-[1.45rem] md:text-[1.55rem]" />
          <SemanticText
            as="p"
            className="hidden text-ink-tertiary md:block"
            role="status"
            text={siteMetadata.tagline}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Cluster>
        <Cluster render={<nav />} className="hidden gap-x-4 gap-y-2 md:flex">
          {Arr.map(
            footerDestinations,
            (destination) => <FooterLink destination={destination} key={destination.href} />
          )}
        </Cluster>
      </Cluster>

      <SemanticText
        as="p"
        className="text-ink-tertiary md:hidden"
        role="status"
        text={siteMetadata.tagline}
        variant="compact"
        wrapAuthority="native-browser"
      />

      <Cluster render={<nav />} className="justify-center gap-x-4 gap-y-2 md:hidden">
        {Arr.map(
          footerDestinations,
          (destination) => <FooterLink destination={destination} key={destination.href} />
        )}
      </Cluster>

      <SemanticText
        as="p"
        className="text-center text-ink-tertiary md:text-left"
        role="status"
        text={`© ${String(siteMetadata.copyrightYear)} ${siteMetadata.legalName}`}
        variant="compact"
      />
    </Stack>
  </Section>
)
