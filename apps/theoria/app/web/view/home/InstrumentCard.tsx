import { Separator } from "@base-ui-components/react/separator"
import { Match } from "effect"

import type { HomeCatalogCardPresentation } from "../../../contracts/presentation/home-catalog.js"
import { cardLiftSpring } from "../../atoms/card-lift.js"
import { useSpringLift } from "../../atoms/spring.js"
import { CardMetaRow } from "../primitives/CardMetaRow.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { Layer, Stack } from "../primitives/Layout.js"
import { CardLink } from "../primitives/Link.js"
import { SelectionRail } from "../primitives/SelectionLayout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import type { Tone } from "../primitives/theme/tone.js"

const liftPx = 3
const liftScale = 0.008

const liftTransform = (progress: number): string | undefined =>
  progress === 0
    ? undefined
    : `translateY(${(-progress * liftPx).toFixed(2)}px) scale(${(1 + progress * liftScale).toFixed(4)})`

const neutralBadgeClassName =
  "inline-flex shrink-0 items-center gap-1 rounded-full border border-stage-200/90 px-2 py-1"

type Badge = {
  readonly className: string
  readonly text: string
  readonly title: string
}

const publishedBadgeClassName = (tone: Tone): string =>
  `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 ${tone.bgSubtle} ${tone.textStrong}`

const badgeFor = ({ card, tone }: { readonly card: HomeCatalogCardPresentation; readonly tone: Tone }): Badge => ({
  className: Match.value(card.status.kind).pipe(
    Match.when("ready", () => publishedBadgeClassName(tone)),
    Match.when("coming-soon", () => `${neutralBadgeClassName} text-ink-500`),
    Match.orElse(() => `${neutralBadgeClassName} text-ink-700`)
  ),
  text: card.status.text,
  title: card.status.title
})

export const InstrumentCard = ({
  card,
  tone
}: {
  readonly card: HomeCatalogCardPresentation
  readonly tone: Tone
}) => {
  const { progress, onPointerEnter, onPointerLeave } = useSpringLift(cardLiftSpring, card.id)
  const badge = badgeFor({ card, tone })
  const badgeSlot = (
    <Layer as="span" className={badge.className} title={badge.title}>
      <SemanticText as="span" role="status" text={badge.text} variant="compact" />
    </Layer>
  )

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
        <SelectionRail action={badgeSlot} className="gap-y-2">
          {card.titlePath !== null
            ? (
              <CardLink className="block min-w-0" href={card.titlePath}>
                <SemanticText
                  as="h3"
                  className="min-w-0 text-ink-900"
                  role="catalog-title"
                  text={card.title}
                  variant="compact"
                />
              </CardLink>
            )
            : (
              <SemanticText
                as="h3"
                className="min-w-0 text-ink-900"
                role="catalog-title"
                text={card.title}
                variant="compact"
              />
            )}
        </SelectionRail>

        <SemanticText
          as="p"
          className="min-w-0 text-ink-700"
          lineLimit={2}
          role="card-summary"
          reserveLines={2}
          text={card.description}
          variant="compact"
          wrapAuthority="effect-text-projected"
        />
      </Stack>

      <Separator className="mt-auto h-px bg-stage-200/80" />

      <CardMetaRow
        className="relative z-10"
        items={card.metaItems}
      />
    </ContentCard>
  )
}
