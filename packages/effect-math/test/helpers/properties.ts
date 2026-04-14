import fc, { type Arbitrary } from "fast-check"

/**
 * Runs deterministic Semigroup and Monoid law checks for one algebra.
 */
export const assertMonoidLaws = <A>(input: {
  readonly arbitrary: Arbitrary<A>
  readonly combine: (left: A, right: A) => A
  readonly equals: (left: A, right: A) => boolean
  readonly identity: A
  readonly seed: number
}): void => {
  fc.assert(
    fc.property(input.arbitrary, input.arbitrary, input.arbitrary, (left, middle, right) => {
      const associativeLeft = input.combine(input.combine(left, middle), right)
      const associativeRight = input.combine(left, input.combine(middle, right))
      const leftIdentity = input.combine(input.identity, left)
      const rightIdentity = input.combine(left, input.identity)

      return input.equals(associativeLeft, associativeRight)
        && input.equals(leftIdentity, left)
        && input.equals(rightIdentity, left)
    }),
    { seed: input.seed }
  )
}
