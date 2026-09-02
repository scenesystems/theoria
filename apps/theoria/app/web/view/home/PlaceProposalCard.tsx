import { LockOpenIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import type { ReactNode } from "react"

import type { PlaceEvidence, ProposalRecord, SealedNote } from "../../../contracts/imagined-place-result.js"
import { ContentCard } from "../primitives/ContentCard.js"
import { contentCardToneClassesFor, toneClassesFor } from "../primitives/designSystem.js"
import { Cluster, Layer, Rail, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { StatusPill } from "../primitives/StatusPill.js"
import { TagBadge } from "../primitives/TagBadge.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

import { ContentId } from "./ContentId.js"
import { mergedIntoText, participantLabel, participantTone, signatureLabel } from "./placeViewModel.js"

const sealTone = toneClassesFor("seal")
const digestTone = toneClassesFor("digest")

const signaturePillClassName = (valid: boolean): string =>
  valid
    ? "border border-stage-200/90 bg-stage-0/80 text-ink-700"
    : "border border-danger-200/80 bg-danger-50/70 text-danger-700"

/** One labelled part of the proposal: the label names what the text is. */
const Field = ({ children, label }: { readonly children: ReactNode; readonly label: string }) => (
  <>
    <SemanticText
      as="dt"
      className="pt-2 text-ink-500 first:pt-0 sm:pt-0"
      role="row-label"
      text={label}
      variant="compact"
    />
    <Layer as="dd" className="min-w-0">{children}</Layer>
  </>
)

/** The neighbor's note, opened: the open lock and caption say how it arrived; the text is theirs. */
const OpenedNote = ({ note }: { readonly note: SealedNote }) => (
  <Stack className={`gap-1.5 rounded-md border px-3 py-2.5 ${sealTone.borderSubtle} ${sealTone.bgTinted}`}>
    <Rail className="gap-1.5">
      <LockOpenIcon aria-hidden className={`size-3.5 shrink-0 ${sealTone.text}`} />
      <SemanticText
        as="span"
        className={sealTone.text}
        role="tab-label"
        text="Opened with your key"
        variant="compact"
      />
    </Rail>
    <SemanticText
      as="p"
      className="text-ink-800"
      role="row-value"
      text={`“${note.openedText}”`}
      variant="compact"
      wrapAuthority="native-browser"
    />
  </Stack>
)

/** Appears when the build records the merge: the same digest tone as the version it names. */
const recordedPillClassName =
  `border ${digestTone.borderSubtle} ${digestTone.bgTinted} ${digestTone.textStrong} transition-[opacity,scale] duration-300 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none`

/**
 * One proposal offered to the author. Header: who offers it (the badge) and
 * the author's decision (the switch). Title: the feature's name, which becomes its marker on the stage.
 * Then three labelled parts — what the proposal adds to the place, why the
 * proposer thinks it belongs, and (for the neighbor) the note sealed to the
 * author. Footer: the proposal's own signature and content ID, which it keeps
 * whether or not it is merged. `accepted` is the author's decision and is
 * shown at once; `record.accepted` is what the last build recorded, and puts
 * the version's name beside the badge. The two differ while a build is in
 * flight, and the card says so.
 */
export const PlaceProposalCard = ({
  accepted,
  evidence,
  note,
  onToggle,
  record
}: {
  readonly accepted: boolean
  readonly evidence: PlaceEvidence
  readonly note: Option.Option<SealedNote>
  readonly onToggle: () => void
  readonly record: ProposalRecord
}) => {
  const role = record.proposal.proposer
  const tone = toneClassesFor(participantTone(role))
  const cardTone = accepted ? { tone: contentCardToneClassesFor(participantTone(role)) } : {}
  const pending = accepted === record.accepted ? {} : { "data-place-pending": "" }

  return (
    <ContentCard
      className={`h-full gap-3 ${accepted ? "border-solid" : "border-dashed"}`}
      data-place-proposal={role}
      data-place-recorded={record.accepted ? "true" : "false"}
      density="compact"
      {...cardTone}
      {...pending}
    >
      <Cluster as="header" className="items-center justify-between gap-x-3 gap-y-1.5">
        <Cluster className="items-center gap-2">
          <TagBadge name={participantLabel(role)} tone={tone} />
          {record.accepted
            ? <StatusPill className={recordedPillClassName} label={mergedIntoText(evidence)} />
            : null}
        </Cluster>
        <Layer className="ml-auto">
          <ToggleSwitch checked={accepted} disabled={false} label="Merge" onToggle={onToggle} tone={tone} />
        </Layer>
      </Cluster>

      <SemanticText
        as="h3"
        className="text-ink-900"
        role="card-title"
        text={record.proposal.feature.name}
        variant="compact"
        wrapAuthority="native-browser"
      />

      <Layer
        as="dl"
        className="grid gap-y-1 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:items-baseline sm:gap-x-3 sm:gap-y-2.5"
      >
        <Field label="Adds">
          <SemanticText
            as="p"
            className="text-ink-800"
            role="row-value"
            text={record.proposal.feature.description}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        <Field label="Why">
          <SemanticText
            as="p"
            className="text-ink-600"
            role="row-value"
            text={record.proposal.feature.rationale}
            variant="compact"
            wrapAuthority="native-browser"
          />
        </Field>
        {Option.match(note, {
          onNone: () => null,
          onSome: (value) => (
            <Field label="Note">
              <OpenedNote note={value} />
            </Field>
          )
        })}
      </Layer>

      <Cluster as="footer" className="items-center gap-x-2.5 gap-y-1">
        <StatusPill
          className={signaturePillClassName(record.signature.valid)}
          label={signatureLabel(record.signature)}
        />
        <ContentId form="short" id={record.contentId} />
      </Cluster>
    </ContentCard>
  )
}
