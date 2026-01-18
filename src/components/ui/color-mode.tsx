// src/components/ui/color-mode.tsx
"use client"
import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@chakra-ui/react"

export function useColorMode() {
  const { resolvedTheme, setTheme } = useTheme()
  const colorMode = resolvedTheme === "dark" ? "dark" : "light"
  const toggleColorMode = () => setTheme(colorMode === "dark" ? "light" : "dark")
  return { colorMode, setColorMode: setTheme, toggleColorMode }
}

export function useColorModeValue<T>(light: T, dark: T): T {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? dark : light
}

export function ColorModeButton() {
  const { toggleColorMode } = useColorMode()
  return <Button variant="outline" size="sm" onClick={toggleColorMode}>Toggle mode</Button>
}
