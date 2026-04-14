import type { ComponentPropsWithRef, ElementType, ReactNode } from "react"

export type BoxProps = ComponentPropsWithRef<"div"> & {
  readonly as?: ElementType
  readonly children?: ReactNode
  readonly className?: string
}

export const cn = (...names: ReadonlyArray<string | false | undefined>): string =>
  names.filter((name): name is string => typeof name === "string" && name.length > 0).join(" ")

export const mergeClassNames = cn

export const withClassName = (className: string | undefined): { readonly className?: string } =>
  className === undefined ? {} : { className }

export const Box = ({ as, className, ...props }: BoxProps) => {
  const Component = as ?? "div"

  return <Component {...props} className={cn("min-w-0", className)} />
}
