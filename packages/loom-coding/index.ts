import { createCliRenderer } from "@opentui/core"
import { createInput } from "./src/input"

const renderer = await createCliRenderer()

const input = createInput()

renderer.root.add(input)

input.focus()