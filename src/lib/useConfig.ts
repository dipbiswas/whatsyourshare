"use client"

import { useEffect, useState } from "react"

interface AppConfig {
  stripeEnabled: boolean
}

export function useConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>({ stripeEnabled: false })

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setConfig(data) })
  }, [])

  return config
}
