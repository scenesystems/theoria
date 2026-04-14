import { Schema } from "effect"

import { EntryId } from "../../../contracts/entry/id.js"

export const LocalProjectionScript = Schema.Struct({
  _tag: EntryId
})

export type LocalProjectionScript = typeof LocalProjectionScript.Type

export const LocalRunFrame = Schema.Struct({
  _tag: EntryId
})

export type LocalRunFrame = typeof LocalRunFrame.Type
