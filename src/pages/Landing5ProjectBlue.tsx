import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import {
  ProjectBluePage,
  ProjectBlueButton,
  ProjectBlueCard,
  ProjectBlueCardBadge,
  ProjectBlueMediaCarousel,
  ProjectBlueHeading,
  isLikelyImageUrl,
  resolveMediaUrl,
} from "../components/project_blue"

function matchesSelectedPost(title?: string | null, description?: string | null): boolean {
  const t = `${title ?? ""}\n${description ?? ""}`.toLowerCase()
  return t.includes("вечеринка идентичность") || t.includes("15.11")
}

export default function Landing5ProjectBlue() {
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [heroImages, setHeroImages] = React.useState<string[]>([])

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=60`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { title?: string | null; description?: string | null; media_urls?: string[] }[]
        const withImages = data.filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
        const preferred = data.find((e) => matchesSelectedPost(e.title, e.description))
        const ordered =
          preferred && withImages.includes(preferred)
            ? [preferred, ...withImages.filter((e) => e !== preferred)]
            : withImages
        const urls = ordered
          .map((e) => {
            const media = (e.media_urls ?? []).find((u) => isLikelyImageUrl(u))
            return resolveMediaUrl(media, apiUrl)
          })
          .filter((u): u is string => u != null)
          .slice(0, 8)
        setHeroImages(urls)
      } catch {
        setHeroImages([])
      }
    }
    void load()
  }, [apiUrl])

  return (
    <ProjectBluePage>
      <ProjectBlueHeading
        stats={
          <>
            <Text>1000+ каналов</Text>
            <Text>·</Text>
            <Text>24/7</Text>
          </>
        }
      >
        Поиск ивентов
        <br />
        и событий в Москве
      </ProjectBlueHeading>

      <Stack gap="10" align="center">
        <ProjectBlueCard title="ПОДБОРКИ С МЕДИА" tilt="left" width="340px" floatClass="tg-float-1">
          <ProjectBlueMediaCarousel images={heroImages} />
        </ProjectBlueCard>

        <ProjectBlueCard title="ИИ-АГЕНТЫ" tilt="right" width="300px" floatClass="tg-float-2">
          <Text fontSize="sm" color="rgba(17,17,17,0.6)" mt="3" lineHeight="1.6">
            ИИ-агенты обрабатывают события и подбирают те, что подходят именно вам.
          </Text>
          <ProjectBlueCardBadge>ПЕРСОНАЛЬНЫЙ ФИД</ProjectBlueCardBadge>
          <Text fontSize="sm" color="rgba(17,17,17,0.6)" mt="3">
            Москва
          </Text>
        </ProjectBlueCard>
      </Stack>

      <Box>
        <ProjectBlueButton onClick={() => navigate({ to: "/feed-3-project-blue" })}>
          Открыть ленту
        </ProjectBlueButton>
      </Box>
    </ProjectBluePage>
  )
}
