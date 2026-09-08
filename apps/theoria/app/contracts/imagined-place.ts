import { Schema } from "effect"
import * as Arr from "effect/Array"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const UnitInterval = Schema.Number.pipe(Schema.between(0, 1))

/**
 * Recorded place patterns a visitor can start from.
 *
 * @since 0.3.0
 */
export const PlaceScenario = Schema.Literal("unfinished-light", "lost-market", "drowned-library")
export type PlaceScenario = typeof PlaceScenario.Type
export const placeScenarios: ReadonlyArray<PlaceScenario> = PlaceScenario.literals

/**
 * What the visitor sees of a pattern before anything is built: its name and
 * the brief the recorded composition was made for. The server scenarios use the
 * same brief, so editing it is the visible difference between "recorded for
 * this brief" and "your brief".
 *
 * @since 0.3.0
 */
export const placeScenarioMeta: Record<PlaceScenario, { readonly label: string; readonly brief: string }> = {
  "unfinished-light": {
    label: "Unfinished light",
    brief:
      "A lighthouse on a rock you can only reach at low tide, whose lamp burns only while someone inside is writing a letter they can't finish. The boats steer by it, so someone always has to be writing."
  },
  "lost-market": {
    label: "Lost market",
    brief:
      "A market that opens once a month in whichever building the town has just emptied, selling only things people have lost. You can buy back your own thing, but only by telling the day you lost it."
  },
  "drowned-library": {
    label: "Drowned library",
    brief:
      "The library of the valley town that was flooded for the reservoir. Every ten years they drain the water for the dam works, and for a week the town comes back to read what survived."
  }
}

/**
 * Who can sign something in the demo. The author is the visitor; the neighbor
 * is another person; the program is the model program acting as a proposer.
 *
 * @since 0.3.0
 */
export const ParticipantRole = Schema.Literal("author", "neighbor", "program")
export type ParticipantRole = typeof ParticipantRole.Type

export const PlaceFeature = Schema.Struct({
  name: NonEmptyString,
  description: NonEmptyString,
  weight: UnitInterval
})
export type PlaceFeature = typeof PlaceFeature.Type

/**
 * Output contract of the composer program in `server/imagined-place/compose.ts`.
 *
 * @since 0.3.0
 */
export const PlaceComposition = Schema.Struct({
  title: NonEmptyString,
  summary: NonEmptyString,
  atmosphere: NonEmptyString,
  features: Schema.Array(PlaceFeature).pipe(Schema.minItems(3))
})
export type PlaceComposition = typeof PlaceComposition.Type

/**
 * Output contract of the proposer program: one feature and why it belongs.
 *
 * @since 0.3.0
 */
export const ProposedFeature = Schema.Struct({
  ...PlaceFeature.fields,
  rationale: NonEmptyString
})
export type ProposedFeature = typeof ProposedFeature.Type

/**
 * A proposal offered to the author. It is digested and signed on its own so it
 * keeps its identity and its proposer's signature after a merge.
 *
 * @since 0.3.0
 */
export const Proposal = Schema.Struct({
  proposer: ParticipantRole,
  feature: ProposedFeature
})
export type Proposal = typeof Proposal.Type

/**
 * One version of the place. The content ID is a digest of this value and
 * nothing else. `parent` is the content ID of the version this one extends, so
 * the chain of IDs is the place's lineage. Presentation never lives here.
 *
 * @since 0.3.0
 */
export const PlaceArtifact = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  parent: Schema.optional(NonEmptyString),
  scenario: PlaceScenario,
  brief: NonEmptyString,
  composition: PlaceComposition,
  accepted: Schema.Array(Proposal)
})
export type PlaceArtifact = typeof PlaceArtifact.Type

/**
 * Every feature that appears in the rendered place: the composition's own,
 * then each accepted proposal's, in acceptance order.
 *
 * @since 0.3.0
 */
export const placeFeatures = (artifact: PlaceArtifact): ReadonlyArray<PlaceFeature> =>
  Arr.appendAll(artifact.composition.features, Arr.map(artifact.accepted, (proposal) => asFeature(proposal.feature)))

/** A proposed feature as it appears in the place once accepted: its rationale stays with the proposal. */
const asFeature = ({ description, name, weight }: ProposedFeature): PlaceFeature => ({ name, description, weight })

export const briefMaxLength = 280

/**
 * Which of the two proposals the place takes: the neighbour's and the
 * proposer program's. Part of every build request, and all the browser needs
 * to know the shape of the place a request will build.
 *
 * @since 0.3.0
 */
export const PlaceAcceptances = Schema.Struct({
  acceptNeighbor: Schema.Boolean,
  acceptProgram: Schema.Boolean
})
export type PlaceAcceptances = typeof PlaceAcceptances.Type

/**
 * Everything the visitor can change about the place itself. Presentation
 * (stage width) is not here: it never reaches the server and never changes a
 * content ID.
 *
 * @since 0.3.0
 */
export const PlaceBuildRequest = Schema.Struct({
  scenario: PlaceScenario,
  brief: NonEmptyString.pipe(Schema.maxLength(briefMaxLength)),
  ...PlaceAcceptances.fields
})
export type PlaceBuildRequest = typeof PlaceBuildRequest.Type

/**
 * What the recorded programs returned for a scenario when the demo was
 * authored: the composer's composition for the scenario's brief, and the two
 * proposals — the neighbour's, then the proposer program's — as they were
 * offered. The server replays these through the real programs, so what the
 * page shows is still a program's schema-checked output, signed and versioned
 * there; the browser reads them only for the shape of what is coming, so the
 * stage is cut to size before the build arrives. The neighbour's sealed note
 * is not here: it is for the author alone.
 *
 * @since 0.3.0
 */
export const PlaceScenarioRecording = Schema.Struct({
  composition: PlaceComposition,
  neighbor: ProposedFeature,
  program: ProposedFeature
})
export type PlaceScenarioRecording = typeof PlaceScenarioRecording.Type

/**
 * The features a build for `acceptances` will have, in the order the server
 * keeps them: the composer's, then each accepted proposal's.
 *
 * @since 0.3.0
 */
export const recordedFeatures = (
  recording: PlaceScenarioRecording,
  acceptances: PlaceAcceptances
): ReadonlyArray<PlaceFeature> =>
  Arr.appendAll(
    recording.composition.features,
    Arr.map(
      Arr.filter(
        [
          { feature: recording.neighbor, accepted: acceptances.acceptNeighbor },
          { feature: recording.program, accepted: acceptances.acceptProgram }
        ],
        (proposal) => proposal.accepted
      ),
      (proposal) => asFeature(proposal.feature)
    )
  )

export const placeScenarioRecordings: Record<PlaceScenario, PlaceScenarioRecording> = {
  "unfinished-light": {
    composition: {
      title: "The Unfinished Light",
      summary:
        "The light on Hollin Skerry burns only while someone in the lamp room is writing a letter they cannot finish, and the boats have steered by it for ninety years.",
      atmosphere:
        "The rock is bare but for lichen and the iron stair, and at high water the sea covers the causeway and keeps whoever is at the desk until morning.",
      features: [
        {
          name: "Causeway",
          description:
            "A causeway of set stones runs out from the harbor for two hours either side of low water, and everyone who crosses it carries paper.",
          weight: 0.5
        },
        {
          name: "The desk",
          description:
            "In the lamp room a single desk faces the sea, and the lamp above it brightens with each line and dims when the pen stops.",
          weight: 0.9
        },
        {
          name: "Pigeonholes",
          description:
            "Behind the desk, letters left unfinished wait in pigeonholes by the year they were begun, the oldest gone brown.",
          weight: 0.7
        },
        {
          name: "The rota",
          description:
            "By the door hangs the rota, written in as many hands as the town has, and the blank line at its foot is for tonight.",
          weight: 0.45
        }
      ]
    },
    neighbor: {
      name: "Finishing shelf",
      description:
        "One shelf by the door holds letters their writers have given up on, and anyone sitting the night may finish one and post it.",
      weight: 0.55,
      rationale:
        "There are letters in those pigeonholes whose writers are dead. Somebody should be allowed to end them."
    },
    program: {
      name: "Ship's bell",
      description:
        "A ship's bell hangs on the gallery, and a boat that loses the light may sound its horn three times to wake whoever has stopped writing.",
      weight: 0.4,
      rationale:
        "The lamp dims when the pen stops and the boats depend on it, but nothing says what a boat does when the light goes out."
    }
  },
  "lost-market": {
    composition: {
      title: "The Market of Lost Things",
      summary:
        "Once a month the market sets up in whatever building the town has most recently emptied, and every stall on its floor sells only what someone has lost.",
      atmosphere:
        "Last month it was the bathhouse; the tiles still sweated, and the stalls were lit by candles set in the drains.",
      features: [
        {
          name: "The ledger",
          description:
            "At the door a woman with a ledger writes your name and one thing you have lost before you may pass.",
          weight: 0.45
        },
        {
          name: "The stalls",
          description:
            "The stalls run by how long a thing has been gone: single gloves near the door, and at the back a table of things lost before anyone living was born.",
          weight: 0.9
        },
        {
          name: "The stool",
          description:
            "To take a thing back you sit on the stool before its stall and tell the day you lost it, and the stallholder knows if you have it wrong.",
          weight: 0.7
        },
        {
          name: "The tin",
          description:
            "Anything not yours costs one thing you found once and never returned, dropped in the tin by the way out.",
          weight: 0.4
        }
      ]
    },
    neighbor: {
      name: "Second telling",
      description:
        "Anyone who has the day wrong may sit again next month, and the stallholder must keep the thing back until then.",
      weight: 0.5,
      rationale:
        "I have told the day my father lost his compass four times and been wrong four times. I will not be wrong a fifth."
    },
    program: {
      name: "Chalk arrow",
      description:
        "On the door of the building the market has just left, one arrow is chalked, pointing the way to the next.",
      weight: 0.35,
      rationale:
        "The market moves every month to a building nobody is using, and nothing in the description says how anyone finds it."
    }
  },
  "drowned-library": {
    composition: {
      title: "The Library Under Cald Water",
      summary:
        "For one week in every ten, when the reservoir is drawn down for the dam, the drowned town's library stands in the open air and the town comes back to read.",
      atmosphere:
        "Mud dries pale on the steps, the lake stays in the smell of the stone, and every page is read at a window because the roof is gone.",
      features: [
        {
          name: "The steps",
          description:
            "Everyone comes down the same steps from the waterline, and each family stops on the one from which its own street can be seen.",
          weight: 0.5
        },
        {
          name: "Reading room",
          description:
            "In the reading room the tables stand where they stood, and the books that survived lie open on them to dry, in shelf order.",
          weight: 0.9
        },
        {
          name: "Borrowers' cards",
          description:
            "The card in each book still lists who took it and when, and the last date in most of them is the same week in 1961.",
          weight: 0.7
        },
        {
          name: "Waterline strip",
          description:
            "A brass strip on the doorframe is moved each decade to where the water stood, and it has never once been moved down.",
          weight: 0.4
        }
      ]
    },
    neighbor: {
      name: "Dry shelf",
      description:
        "One shelf by the door is kept under oilcloth for the books written about the town since, and it is the only shelf allowed to be full.",
      weight: 0.5,
      rationale:
        "I have never seen the town except this week. Everything I know about it, someone wrote down after. Those books should be down here too."
    },
    program: {
      name: "Closing bell",
      description:
        "On the seventh evening the bell from the drowned church is rung from the steps, and every book is closed and laid face down before the sluices shut.",
      weight: 0.45,
      rationale:
        "The town comes back for one week and the water returns after, but nothing says how the week ends or what is done with the books before it does."
    }
  }
}

export class PlaceBuildError extends Schema.TaggedError<PlaceBuildError>()("PlaceBuildError", {
  stage: Schema.Literal("compose", "propose", "identity", "render", "signature", "seal"),
  message: Schema.String
}) {}
