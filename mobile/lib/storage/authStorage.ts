import * as SecureStore from "expo-secure-store"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
    return
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (!token) {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
    return
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token)
}
