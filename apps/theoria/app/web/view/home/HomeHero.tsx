import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { InternalLink } from "../primitives/Link.js"
import { SemanticText } from "../primitives/SemanticText.js"

const docsLinkClassName =
  "inline-flex items-center rounded-lg border border-stage-300/90 bg-stage-0/88 px-3.5 py-2 text-ink-900 shadow-chip transition-colors hover:border-ink-400 hover:bg-stage-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900/20"

export const HomeHero = () => (
  <Section className="py-6 sm:py-10">
    <Stack className="gap-5">
      <Stack className="gap-4">
        <SemanticText
          as="h1"
          className="max-w-3xl text-ink-900"
          role="hero-title"
          text="Scientific computing and model programming with Effect"
          variant="expanded"
          wrapAuthority="native-browser"
        />
        <SemanticText
          as="p"
          className="max-w-3xl text-ink-700"
          role="hero-body"
          text="Theoria is an open-source collection of TypeScript libraries for reproducible computational work in Effect applications."
          variant="expanded"
          wrapAuthority="native-browser"
        />
      </Stack>
      <Cluster className="gap-3">
        <InternalLink className={docsLinkClassName} href="/docs">
          <SemanticText as="span" role="button-label" text="Browse the packages" />
        </InternalLink>
      </Cluster>
    </Stack>
  </Section>
)
