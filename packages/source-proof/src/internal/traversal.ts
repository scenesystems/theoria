import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

const childNodes = (sourceFile: ts.SourceFile, node: ts.Node): ReadonlyArray<ts.Node> =>
  Arr.fromIterable(node.getChildren(sourceFile))

export const collectFromAst = <A>(
  sourceFile: ts.SourceFile,
  collect: (node: ts.Node) => ReadonlyArray<A>
): ReadonlyArray<A> => {
  const visit = (node: ts.Node): ReadonlyArray<A> =>
    Arr.appendAll(collect(node), Arr.flatMap(childNodes(sourceFile, node), visit))

  return visit(sourceFile)
}

export const renderExpressionChain = (expression: ts.Expression): Option.Option<string> => {
  if (ts.isIdentifier(expression)) {
    return Option.some(expression.text)
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return Option.map(renderExpressionChain(expression.expression), (prefix) => `${prefix}.${expression.name.text}`)
  }

  return Option.none()
}
