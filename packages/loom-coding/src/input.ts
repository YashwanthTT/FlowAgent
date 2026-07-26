import { Input } from "@opentui/core"

export function createInput() {
    const input = Input({
        placeholder: "Type something...",
        width: 30,
    })

    return input
}