import { LockOpenIcon } from "@heroicons/react/20/solid"
import { Option } from "effect"
import type { ReactNode } from "react"

import type { PlaceEvidence, ProposalRecord, SealedNote } from "../../../contracts/imagined-place-result.js"
import { dangerStatusTone, inlineStatusToneFor, neutralStatusTone, toneClassesFor } from "../primitives/designSystem.js"
import { InlineStatus } from "../primitives/InlineStatus.js"
import { Cluster, Layer, Rail, Stack } from "../primitives/Layout.js"
import { ParticipantName } from "../primitives/ParticipantName.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ToggleSwitch } from "../primitives/ToggleSwitch.js"

import { ContentId } from "./ContentId.js"
import { mergedIntoText, participantLabel, participantTone, signatureLabel } from "./placeViewModel.js"

const sealTone = toneClassesFor("seal")

const signatureTone = (valid: boolean) => valid ? neutralStatusTone : dangerStatusTone

/**
 * The voice's rule: a proposer's accent while their proposal is merged, a
 * dashed neutral hairline while it is declined. It is the only edge the
 * proposal has; there is no box behind the words.
 */
const voiceClassName = (accepted: boolean, tone: { readonly border: string }): string =>
  accepted ? `border-solid ${tone.border}` : "border-dashed border-rule-strong"

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
    <Layer render={<dd />} className="min-w-0">{children}</Layer>
  </>
)

/** The neighbor's note, opened: the open lock and caption say how it arrived; the text is theirs. */
const OpenedNote = ({ note }: { readonly note: SealedNote }) => (
  <Stack className={`gap-1.5 border-l-2 pl-3 ${sealTone.border}`}>
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
const recordedTone = inlineStatusToneFor("digest")
const recordedClassName =
  "transition-[opacity,translate] duration-300 ease-out starting:translate-x-1 starting:opacity-0 motion-reduce:transition-none"

/**
 * One proposal offered to the author, spoken in their voice: a rule in the
 * proposer's accent down its left edge and no box. Header: who offers it (the
 * name) and the author's decision (the switch). Title: the feature's name, which becomes its marker on the stage.
 * Then three labelled parts — what the proposal adds to the place, why the
 * proposer thinks it belongs, and (for the neighbor) the note sealed to the
 * author. Footer: the proposal's own signature and content ID, which it keeps
 * whether or not it is merged. `accepted` is the author's decision and is
 * shown at once; `record.accepted` is what the last build recorded, and puts
 * the version's name beside the badge. The two differ while a build is in
 * flight, and the article says so.
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
  const pending = accepted === record.accepted ? {} : { "data-place-pending": "" }

  return (
    <Stack
      render={<article />}
      className={`h-full gap-3 border-l-2 pl-4 transition-colors duration-300 ${voiceClassName(accepted, tone)}`}
      data-place-proposal={role}
      data-place-recorded={record.accepted ? "true" : "false"}
      {...pending}
    >
      <Cluster render={<header />} className="items-center justify-between gap-x-3 gap-y-1.5">
        <Cluster className="items-center gap-x-3 gap-y-1">
          <ParticipantName name={participantLabel(role)} tone={tone} />
          {record.accepted
            ? <InlineStatus className={recordedClassName} label={mergedIntoText(evidence)} tone={recordedTone} />
            : null}
        </Cluster>
        <Layer className="ml-auto">
          <ToggleSwitch
            checked={accepted}
            disabled={false}
            label="Merge"
            onToggle={onToggle}
            subject={record.proposal.feature.name}
            tone={tone}
          />
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
        render={<dl />}
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

      <Cluster render={<footer />} className="items-center gap-x-3 gap-y-1">
        <InlineStatus label={signatureLabel(record.signature)} tone={signatureTone(record.signature.valid)} />
        <ContentId form="short" id={record.contentId} />
      </Cluster>
    </Stack>
  )
}
