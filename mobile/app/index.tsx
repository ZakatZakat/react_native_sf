import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native"

import { useEvents } from "../lib/api/queries"
import type { EventCard } from "../lib/api/types"

export default function HomeScreen() {
  const { data, isLoading, error, refetch } = useEvents(20)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Event Channel</Text>
        <Pressable onPress={() => refetch()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load events</Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <EventRow item={item} />}
        />
      )}
    </View>
  )
}

function EventRow({ item }: { item: EventCard }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cardMeta}>{item.channel}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#111111",
  },
  refreshText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111111",
  },
  cardMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(0,0,0,0.6)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  muted: {
    fontSize: 12,
    color: "rgba(0,0,0,0.6)",
  },
  error: {
    fontSize: 12,
    color: "#B00020",
  },
})
