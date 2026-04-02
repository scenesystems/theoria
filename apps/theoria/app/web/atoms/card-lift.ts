import { makeSpringAtom } from "./spring.js"

/**
 * Spring animation for card hover lift on the home page.
 *
 * @since 0.1.0
 */
export const cardLiftSpring = makeSpringAtom({
  stiffness: 0.12,
  damping: 0.72
})
