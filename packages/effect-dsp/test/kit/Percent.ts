import { BigDecimal, Option } from "effect"

/**
 * Recovers a told MIPROv2 percentage from its public fraction without binary
 * arithmetic. Told values have two decimals and fractions are `percent / 100`,
 * so shifting the fraction's decimal by two places and rounding to cents is
 * exact for every reachable percentage.
 */
export const toldPercent = (fraction: number): BigDecimal.BigDecimal =>
  BigDecimal.round(
    BigDecimal.multiply(Option.getOrThrow(BigDecimal.fromNumber(fraction)), BigDecimal.fromBigInt(100n)),
    {
      scale: 2,
      mode: "half-even"
    }
  )
