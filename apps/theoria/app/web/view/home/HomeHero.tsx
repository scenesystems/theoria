import { homeHeroCopy } from "../../../contracts/presentation/home.js"
import { defaultWorkflowStudyPath } from "../../../contracts/study/workflow/catalog-policy.js"
import { LinkButton } from "../../ui/components/action/LinkButton.js"
import { Cluster } from "../../ui/structure/Cluster.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

export const HomeHero = () => (
  <Stack as="section" className="gap-6 border-b border-stage-200/80 pb-10 sm:gap-7 sm:pb-12">
    <Stack className="gap-4">
      <SemanticText
        as="h1"
        className="text-balance text-content-primary"
        role="display-lg"
        tone="inherit"
      >
        {homeHeroCopy.title}
      </SemanticText>
      <SemanticText
        as="p"
        className="max-w-[42rem] text-pretty text-content-muted"
        role="body-lg"
        tone="inherit"
      >
        {homeHeroCopy.body}
      </SemanticText>
    </Stack>
    <Cluster gap="sm">
      <LinkButton
        href={defaultWorkflowStudyPath}
        size="lg"
        tone="primary"
      >
        {homeHeroCopy.primaryActionLabel}
      </LinkButton>
      <LinkButton
        href="/packages"
        size="lg"
        tone="neutral"
      >
        {homeHeroCopy.secondaryActionLabel}
      </LinkButton>
    </Cluster>
  </Stack>
)
