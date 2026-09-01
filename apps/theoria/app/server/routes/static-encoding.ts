import { Option } from "effect"
import * as Arr from "effect/Array"

export const acceptsGzip = (header: Option.Option<string>): boolean =>
  Option.exists(header, (value) => {
    const preferences = Arr.map(value.split(","), (entry) => {
      const [coding, ...parameters] = entry.trim().toLocaleLowerCase("en-US").split(";")
      const quality = Arr.findFirst(parameters, (parameter) => parameter.trim().startsWith("q="))
      return {
        coding,
        accepted: Option.match(quality, {
          onNone: () => true,
          onSome: (parameter) => Number.parseFloat(parameter.trim().slice(2)) > 0
        })
      }
    })
    return Option.match(Arr.findFirst(preferences, ({ coding }) => coding === "gzip"), {
      onNone: () =>
        Option.exists(Arr.findFirst(preferences, ({ coding }) => coding === "*"), ({ accepted }) => accepted),
      onSome: ({ accepted }) => accepted
    })
  })
