export type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  event_time?: string | null
  media_urls?: string[]
  location?: string | null
  price?: string | null
  category?: string | null
  source_link?: string | null
  created_at: string
}
