import { homeHeroCopy } from "../../../contracts/presentation/home.js"
import { Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const HomeHero = () => (
  <Section className="py-6 sm:py-10">
    <Stack className="gap-3">
      <SemanticText
        as="h1"
        className="max-w-3xl text-ink-900"
        role="hero-title"
        text={homeHeroCopy.title}
        variant="expanded"
        wrapAuthority="native-browser"
      />
      <SemanticText
        as="p"
        className="max-w-3xl text-ink-700"
        role="hero-body"
        text={homeHeroCopy.body}
        variant="expanded"
      />
    </Stack>
  </Section>
)
