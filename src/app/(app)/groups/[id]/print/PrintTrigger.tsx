"use client"

import { useEffect } from "react"

export function PrintTrigger() {
  useEffect(() => {
    // Small delay so styles are applied before the dialog opens
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  return null
}
