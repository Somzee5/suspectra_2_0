import Cookies from 'js-cookie'
import type { User } from '@/types'

const TOKEN_KEY = 'suspectra_token'
const USER_KEY  = 'suspectra_user'

export const setAuth = (token: string, user: User): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  Cookies.set(TOKEN_KEY, token, { expires: 1, sameSite: 'strict' })
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as User) : null
}

export const clearAuth = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  Cookies.remove(TOKEN_KEY)
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}
