import { pow } from "@scenesystems/effect-math/Numeric"

const e = 2.718281828459045

export const exp = (value: number): number => pow(e, value)
