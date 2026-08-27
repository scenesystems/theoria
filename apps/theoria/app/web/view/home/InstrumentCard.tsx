import { Separator } from "@base-ui-components/react/separator"
import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"

import type { Card } from "../../../contracts/card.js"
import { cardLiftSpring } from "../../atoms/card-lift.js"
import { packageVersionsAtom } from "../../atoms/package-versions.js"
import { useSpringLift } from "../../atoms/spring.js"
import type { MetaItem } from "../primitives/CardMetaRow.js"
import { CardMetaRow } from "../primitives/CardMetaRow.js"
import { ContentCard } from "../primitives/ContentCard.js"
import type { ToneClasses } from "../primitives/designSystem.js"
import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const metaItems = (card: Card, version: string): ReadonlyArray<MetaItem> => [
  { _tag: "link", label: `npm@${version}`, href: card.npmUrl },
  { _tag: "link", label: "Source", href: card.repoUrl },
  { _tag: "text", label: card.license }
]

const liftPx = 3
const liftScale = 0.008

const liftTransform = (progress: number): string | undefined =>
  progress === 0
    ? undefined
    : `translateY(${(-progress * liftPx).toFixed(2)}px) scale(${(1 + progress * liftScale).toFixed(4)})`

export const InstrumentCard = ({
  card,
  tone
}: {
  readonly card: Card
  readonly tone: ToneClasses
}) => {
  const { progress, onPointerEnter, onPointerLeave } = useSpringLift(cardLiftSpring, card.id)
  const versionsResult = useAtomValue(packageVersionsAtom)
  const resolvedVersion = Result.match(versionsResult, {
    onInitial: () => card.version,
    onSuccess: (success) => success.value[card.packageName] ?? card.version,
    onFailure: () => card.version
  })

  return (
    <ContentCard
      className={`relative h-full ${tone.border}`}
      density="standard"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      shape="left-accent"
      style={{ transform: liftTransform(progress) }}
    >
      <Stack className="min-w-0 gap-3">
        <SemanticText
          as="h3"
          className="min-w-0 text-ink-900"
          role="catalog-title"
          text={card.title}
          variant="compact"
        />

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          lineLimit={2}
          role="card-summary"
          reserveLines={2}
          text={card.description}
          variant="compact"
          wrapAuthority="native-browser"
        />
      </Stack>

      <Separator className="mt-auto h-px bg-stage-200/80" />

      <CardMetaRow
        className="relative z-10"
        items={metaItems(card, resolvedVersion)}
      />
    </ContentCard>
  )
}
