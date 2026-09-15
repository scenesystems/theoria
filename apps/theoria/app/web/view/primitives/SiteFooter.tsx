import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Schema } from "effect"
import * as Arr from "effect/Array"

import { siteMetadata } from "../../../contracts/metadata.js"
import { respondColorsClassName } from "./designSystem.js"
import { Cluster, Layer, Section } from "./Layout.js"
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
    <SemanticText as="span" role="row-value" text={destination.label} variant="compact" />
    <ArrowTopRightOnSquareIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
  </ExternalLink>
)

export const SiteFooter = () => (
  <Section
    render={<footer />}
    className="mt-region border-t border-hairline-veil pb-3 pt-6"
    data-site-footer
  >
    <Layer className="grid items-center justify-items-center gap-x-8 gap-y-3 md:grid-cols-2 md:justify-items-stretch">
      <TheoriaLogo animation="glossary" className="md:justify-self-start" />
      <SemanticText
        as="p"
        className="text-center md:col-start-1 md:row-start-2 md:text-left"
        role="caption"
        text={siteMetadata.tagline}
        variant="compact"
        wrapAuthority="native-browser"
      />

      <Cluster
        render={<nav aria-label="Footer" />}
        className="justify-center gap-x-5 gap-y-3 md:col-start-2 md:row-start-1 md:justify-end"
      >
        {Arr.map(
          footerDestinations,
          (destination) => <FooterLink destination={destination} key={destination.href} />
        )}
      </Cluster>

      <SemanticText
        as="p"
        className="text-center md:col-start-2 md:row-start-2 md:text-right"
        role="caption"
        text={`© ${String(siteMetadata.copyrightYear)} ${siteMetadata.legalName}`}
        variant="compact"
      />
    </Layer>
  </Section>
)
