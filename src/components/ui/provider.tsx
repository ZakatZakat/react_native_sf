// src/components/ui/provider.tsx
import * as React from "react"
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"
import { ThemeProvider } from "next-themes"

// Point Chakra's font tokens at ours. Chakra's global reset writes
// `body { font-family: token(fonts.body) }`, and defaultSystem's default is a
// SYSTEM stack — so any Chakra <Text>/<Box> without an explicit fontFamily
// rendered in SF/Arial, not Inter. Binding body/heading/mono to the --cs-font-*
// tokens makes Inter/JetBrains the inherited default everywhere.
const csSystem = createSystem(
  defaultConfig,
  defineConfig({
    theme: {
      tokens: {
        fonts: {
          body: { value: "var(--cs-font-sans)" },
          heading: { value: "var(--cs-font-sans)" },
          mono: { value: "var(--cs-font-mono)" },
        },
      },
    },
  }),
)

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={csSystem}>
      {/* next-themes attaches "class" (light/dark) to <html> */}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  )
}
