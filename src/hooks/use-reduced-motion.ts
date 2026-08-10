import * as React from "react"

export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener("change", onChange)
    setReduced(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return reduced
}
