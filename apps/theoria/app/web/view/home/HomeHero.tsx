import { Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const HomeHero = () => (
  <Section className="py-6 sm:py-10">
    <Stack className="gap-2">
      <SemanticText
        as="h1"
        className="max-w-3xl text-ink-900"
        role="hero-title"
        text="Instruments for Effect-native scientific computing"
        variant="expanded"
        wrapAuthority="native-browser"
      />
    </Stack>
  </Section>
)
