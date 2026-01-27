import Constants from "expo-constants"

type ExpoExtra = {
  apiBaseUrl?: string
}

const extra = Constants.expoConfig?.extra as ExpoExtra | undefined

export const API_BASE_URL = extra?.apiBaseUrl ?? "http://localhost:8000"
