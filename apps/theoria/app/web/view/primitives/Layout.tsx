import type { ComponentPropsWithRef, ElementType } from "react"

import { classNames } from "./classNames.js"

type SlotProps<E extends ElementType> = ComponentPropsWithRef<E> & {
  readonly as?: E
  readonly className?: string
}

export const Layer = <E extends ElementType = "div">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classNames("min-w-0", className)} />
}

export const Header = <E extends ElementType = "header">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "header"

  return <Component {...props} className={classNames("min-w-0", className)} />
}

export const Main = <E extends ElementType = "main">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "main"

  return <Component {...props} className={classNames("min-w-0", className)} />
}

export const Nav = <E extends ElementType = "nav">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "nav"

  return <Component {...props} className={classNames("min-w-0", className)} />
}

export const Section = <E extends ElementType = "section">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "section"

  return <Component {...props} className={classNames("min-w-0", className)} />
}

export const Stack = <E extends ElementType = "div">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classNames("flex min-w-0 flex-col", className)} />
}

export const Rail = <E extends ElementType = "div">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classNames("flex min-w-0 items-center", className)} />
}

export const Cluster = <E extends ElementType = "div">({
  as,
  className = "",
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classNames("flex min-w-0 flex-wrap items-center", className)} />
}
