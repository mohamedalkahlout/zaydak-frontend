"use client"

import { useState } from "react"
import { SimpleEditor } from "@/shared/components/tiptap-templates/simple/simple-editor"

export default function Page() {
  const [value, setValue] = useState("")
  return <SimpleEditor value={value} onChange={setValue} />
}
