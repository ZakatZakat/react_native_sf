import { useQuery } from "@tanstack/react-query"

import { listEvents } from "./endpoints"
import { queryKeys } from "./queryKeys"

export function useEvents(limit: number) {
  return useQuery({
    queryKey: queryKeys.events(limit),
    queryFn: () => listEvents(limit),
  })
}
