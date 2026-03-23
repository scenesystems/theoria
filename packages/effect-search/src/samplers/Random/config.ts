import { HashMap, Record } from "effect"

export type ConfigValues = HashMap.HashMap<string, unknown>

export const emptyConfigValues = (): ConfigValues => HashMap.empty<string, unknown>()

export const setConfigValue = (raw: ConfigValues, key: string, value: unknown): ConfigValues =>
  HashMap.set(raw, key, value)

export const configObject = (raw: ConfigValues): unknown => Record.fromEntries(HashMap.toEntries(raw))
