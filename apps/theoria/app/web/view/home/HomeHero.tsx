import { Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const HomeHero = () => (
  <Section className="py-6 sm:py-10">
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
  </Section>
)
