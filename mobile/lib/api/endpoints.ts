import { request } from "./request"
import { EventCard } from "./types"

export async function listEvents(limit: number): Promise<EventCard[]> {
  return request<EventCard[]>({
    path: `/events?limit=${limit}`,
  })
}
