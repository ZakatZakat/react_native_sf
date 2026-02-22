import { useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Stack } from "@chakra-ui/react"
import { PersonalFeed, getFeedTagsForPage } from "./PipeMyProfile"
import { PipeFooter } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

export default function PipePersonalFeed() {
  const navigate = useNavigate()
  const feedTags = useMemo(() => getFeedTagsForPage(), [])

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative">
      <Stack maxW="430px" mx="auto" px="6" pt="14" pb="20" gap="0" position="relative" zIndex={1}>
        <PersonalFeed
          tags={feedTags}
          onBack={() => navigate({ to: "/pipe-personal" })}
        />
        <Box pt="8">
          <PipeFooter muted={G} accent={K} hoverColor={B} />
        </Box>
      </Stack>
    </Box>
  )
}
