import { GlobeAltIcon } from "@heroicons/react/20/solid"

import { GitHubMark, XMark } from "./BrandMarks.js"
import { Cluster } from "./Layout.js"
import { ExternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"

// eslint-disable-next-line no-restricted-syntax -- static render-time constant, not a side effect
const COPYRIGHT_YEAR = new Date().getFullYear()

const footerLink = "inline-flex items-center gap-1.5 text-ink-700 transition-colors duration-150 hover:text-ink-900"

export const SiteFooter = () => (
  <footer className="border-t border-stage-200/90 pt-5">
    <Cluster className="items-center justify-between gap-4">
      <SemanticText
        as="span"
        className="text-ink-700"
        role="row-label"
        text={`© ${COPYRIGHT_YEAR} Scene Systems`}
        variant="expanded"
      />

      <Cluster className="gap-4">
        <ExternalLink className={footerLink} href="https://github.com/scenesystems/theoria">
          <GitHubMark className="shrink-0" />
          <SemanticText as="span" className="text-ink-700" role="row-label" text="GitHub" variant="compact" />
        </ExternalLink>

        <ExternalLink className={footerLink} href="https://scenesystems.io">
          <GlobeAltIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <SemanticText as="span" className="text-ink-700" role="row-label" text="scenesystems.io" variant="compact" />
        </ExternalLink>

        <ExternalLink className={footerLink} href="https://x.com/scenesystems">
          <XMark className="shrink-0" />
          <SemanticText as="span" className="text-ink-700" role="row-label" text="@scenesystems" variant="compact" />
        </ExternalLink>
      </Cluster>
    </Cluster>
  </footer>
)
