import type { ComponentProps } from "react"

import { DetailList } from "../detail/DetailList.js"

export const InspectorDetailList = (props: ComponentProps<typeof DetailList>) => <DetailList {...props} />
