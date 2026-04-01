import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

export const HomeHero = () => (
  <Section className="py-6 sm:py-10">
    <Stack className="gap-2">
      <Cluster className="items-baseline gap-2">
        <SemanticText as="p" className="italic text-ink-500" role="hero-body" text="θεωρία" variant="expanded" />
        <SemanticText
          as="p"
          className="text-ink-500"
          role="hero-body"
          text="— observation that produces knowledge"
          variant="expanded"
        />
      </Cluster>
      <SemanticText
        as="h1"
        className="max-w-3xl text-ink-900"
        role="hero-title"
        text="Instruments for Effect-native scientific computing"
        variant="expanded"
      />
    </Stack>
  </Section>
)
