export const queryKeys = {
  events: (limit: number) => ["events", { limit }] as const,
}
