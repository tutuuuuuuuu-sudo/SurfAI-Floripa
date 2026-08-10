import * as React from "react"

let cachedSupport: boolean | null = null

function detectWebglSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport
  try {
    const canvas = document.createElement("canvas")
    cachedSupport = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    cachedSupport = false
  }
  return cachedSupport
}

export function useWebglSupport() {
  const [supported] = React.useState(detectWebglSupport)
  return supported
}
