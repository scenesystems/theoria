import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"

import { dspWidgetViewModelAtom, selectDspEvaluationCaseAtom } from "../../atoms/dsp-widget.js"
import { Grid } from "../containers/Grid.js"
import { ChoicePills } from "../primitives/ChoicePills.js"
import { ContentCard } from "../primitives/ContentCard.js"
import {
  contentCardDangerClasses,
  contentCardToneClassesFor,
  surfaceMaterials,
  toneClassesFor
} from "../primitives/designSystem.js"
import { Cluster, Stack } from "../primitives/Layout.js"
import { MetricStrip } from "../primitives/MetricStrip.js"
import { SemanticText } from "../primitives/SemanticText.js"

const tone = toneClassesFor("dsp")
const dspCardTone = contentCardToneClassesFor("dsp")

const evaluationCardTone = (correct: boolean) => correct ? dspCardTone : contentCardDangerClasses

const evaluationLabelClassName = (correct: boolean): string => correct ? tone.textStrong : "text-danger-700"

const evaluationStatus = (correct: boolean): string => correct ? "correct" : "miss"

const EvaluationTrackCard = ({
  correct,
  label,
  rationale,
  title
}: {
  readonly correct: boolean
  readonly label: string
  readonly rationale: string
  readonly title: string
}) => (
  <ContentCard density="standard" tone={evaluationCardTone(correct)}>
    <Cluster className="items-start justify-between gap-3">
      <SemanticText as="p" className="text-ink-700" role="row-label" text={title} variant="expanded" />
      <SemanticText
        as="span"
        className={evaluationLabelClassName(correct)}
        role="row-value"
        text={evaluationStatus(correct)}
        variant="expanded"
      />
    </Cluster>
    <SemanticText as="p" className="text-ink-900" role="card-title" text={label} variant="expanded" />
    <SemanticText as="p" className="text-ink-700" role="card-summary" text={rationale} variant="expanded" />
  </ContentCard>
)

export const LiveDspEvaluation = () => {
  const vm = useAtomValue(dspWidgetViewModelAtom)
  const selectCase = useAtomSet(selectDspEvaluationCaseAtom)

  return (
    <Stack className="mx-auto w-full max-w-6xl gap-4 xl:px-4 2xl:px-6">
      <ChoicePills
        activeIndex={vm.activeIndex}
        className="w-full gap-2 xl:justify-center"
        disabled={false}
        onSelect={selectCase}
        options={vm.options}
        tone={tone}
      />

      <MetricStrip metrics={vm.metrics} />

      <Stack className={`${surfaceMaterials.raisedCard} gap-4 p-5 sm:p-6`}>
        <Cluster className="items-start justify-between gap-3">
          <Stack className="gap-1">
            <SemanticText
              as="p"
              className={tone.text}
              role="row-label"
              text="Typed evaluation artifact"
              variant="expanded"
            />
            <SemanticText
              as="h3"
              className="text-ink-900"
              role="section-title"
              text={vm.activeCase.label}
              variant="expanded"
            />
          </Stack>
          <ContentCard className="w-full sm:w-auto" density="compact" tone={dspCardTone}>
            <Stack className="gap-1">
              <SemanticText
                as="p"
                className="text-ink-700"
                role="row-label"
                text="Expected label"
                variant="expanded"
              />
              <SemanticText
                as="p"
                className={tone.textStrong}
                role="row-value"
                text={vm.activeCase.expectedLabel}
                variant="expanded"
              />
            </Stack>
          </ContentCard>
        </Cluster>

        <ContentCard density="standard" tone={dspCardTone}>
          <Stack className="gap-2">
            <SemanticText
              as="p"
              className="text-ink-700"
              role="row-label"
              text="Input text"
              variant="expanded"
            />
            <SemanticText
              as="p"
              className="text-ink-900"
              role="card-summary"
              text={vm.activeCase.input}
              variant="expanded"
            />
          </Stack>
        </ContentCard>

        <Grid className="gap-3 xl:gap-4" layout="lead-rail">
          <ContentCard density="standard">
            <Stack className="gap-3">
              <SemanticText
                as="p"
                className={tone.text}
                role="row-label"
                text="Program contract"
                variant="expanded"
              />
              <SemanticText
                as="p"
                className="text-ink-900"
                role="card-summary"
                text={vm.contract.instruction}
                variant="expanded"
              />
              <Cluster className="items-stretch gap-3">
                <ContentCard className="flex-1" density="compact" tone={dspCardTone}>
                  <Stack className="gap-1">
                    <SemanticText
                      as="p"
                      className="text-ink-700"
                      role="row-label"
                      text="Input field"
                      variant="expanded"
                    />
                    <SemanticText
                      as="p"
                      className="text-ink-900"
                      role="row-value"
                      text={vm.contract.inputField}
                      variant="expanded"
                    />
                  </Stack>
                </ContentCard>
                <ContentCard className="flex-1" density="compact" tone={dspCardTone}>
                  <Stack className="gap-1">
                    <SemanticText
                      as="p"
                      className="text-ink-700"
                      role="row-label"
                      text="Output field"
                      variant="expanded"
                    />
                    <SemanticText
                      as="p"
                      className="text-ink-900"
                      role="row-value"
                      text={vm.contract.outputField}
                      variant="expanded"
                    />
                  </Stack>
                </ContentCard>
              </Cluster>
            </Stack>
          </ContentCard>

          <Stack className="gap-3">
            <EvaluationTrackCard
              correct={vm.activeCase.heuristicCorrect}
              label={vm.activeCase.heuristicLabel}
              rationale={vm.activeCase.heuristicRationale}
              title="Heuristic baseline"
            />
            <EvaluationTrackCard
              correct={vm.activeCase.modelCorrect}
              label={vm.activeCase.modelLabel}
              rationale={vm.activeCase.modelRationale}
              title="Typed provider program"
            />
          </Stack>
        </Grid>
      </Stack>

      <Stack className={`${surfaceMaterials.callout} gap-0`}>
        <SemanticText
          as="p"
          className="text-ink-700"
          role="card-summary"
          text={vm.activeCase.note}
          variant="expanded"
        />
      </Stack>
    </Stack>
  )
}
