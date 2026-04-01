import type { ComponentPropsWithRef, ElementType, ReactNode } from "react"

type SlotProps<E extends ElementType> = {
  readonly as?: E
  readonly children?: ReactNode
  readonly className?: string
} & Omit<ComponentPropsWithRef<E>, "as" | "children" | "className">

const classes = (base: string, value: string | undefined): string =>
  [base, value ?? ""].filter((entry) => entry.length > 0).join(" ")

export const Layer = <E extends ElementType = "div">({
  as,
  className,
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classes("min-w-0", className)} />
}

export const Header = <E extends ElementType = "header">({
  as,
  className,
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "header"

  return <Component {...props} className={classes("min-w-0", className)} />
}

export const Section = <E extends ElementType = "section">({
  as,
  className,
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "section"

  return <Component {...props} className={classes("min-w-0", className)} />
}

export const Stack = <E extends ElementType = "div">({
  as,
  className,
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classes("flex min-w-0 flex-col", className)} />
}

export const Cluster = <E extends ElementType = "div">({
  as,
  className,
  ...props
}: SlotProps<E>) => {
  const Component = as ?? "div"

  return <Component {...props} className={classes("flex min-w-0 flex-wrap items-center", className)} />
}
