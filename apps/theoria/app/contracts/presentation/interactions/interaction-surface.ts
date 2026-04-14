import { Match, Schema } from "effect"
import * as Option from "effect/Option"

import { InteractionItem } from "./interaction-item.js"

type InteractionFlowItem = typeof InteractionItem.Type

export class InteractionTurnModel extends Schema.Class<InteractionTurnModel>("InteractionTurnModel")({
  id: Schema.String,
  items: Schema.Array(InteractionItem)
}) {}

export class InteractionSurfaceModel extends Schema.Class<InteractionSurfaceModel>("InteractionSurfaceModel")({
  emptyText: Schema.String,
  turns: Schema.Array(InteractionTurnModel)
}) {}

const interactionItemId = (item: InteractionFlowItem): string =>
  Match.value(item).pipe(
    Match.tag("InteractionMessageItem", ({ message }) => message.id),
    Match.tag("InteractionActionItem", ({ id }) => id),
    Match.exhaustive
  )

const interactionTurn = ({
  id,
  items
}: {
  readonly id: string
  readonly items: ReadonlyArray<InteractionFlowItem>
}): InteractionTurnModel =>
  InteractionTurnModel.make({
    id,
    items
  })

const appendTurnItem = ({
  item,
  turns
}: {
  readonly item: InteractionFlowItem
  readonly turns: ReadonlyArray<InteractionTurnModel>
}): ReadonlyArray<InteractionTurnModel> =>
  Option.match(Option.fromNullable(turns.at(-1)), {
    onNone: () => [interactionTurn({ id: interactionItemId(item), items: [item] })],
    onSome: (lastTurn) => [
      ...turns.slice(0, -1),
      interactionTurn({
        id: lastTurn.id,
        items: [...lastTurn.items, item]
      })
    ]
  })

export const interactionSurfaceModel = ({
  emptyText,
  items
}: {
  readonly emptyText: string
  readonly items: ReadonlyArray<InteractionFlowItem>
}): InteractionSurfaceModel =>
  InteractionSurfaceModel.make({
    emptyText,
    turns: items.reduce<ReadonlyArray<InteractionTurnModel>>(
      (turns, item) =>
        item._tag === "InteractionMessageItem"
          ? [...turns, interactionTurn({ id: interactionItemId(item), items: [item] })]
          : appendTurnItem({ item, turns }),
      []
    )
  })
