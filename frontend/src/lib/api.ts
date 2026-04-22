import axios from 'axios'
import { getToken, clearAuth } from './auth'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  sendOtp:   (email: string)              => api.post('/auth/send-otp', { email }),
  verifyOtp: (email: string, otp: string) => api.post('/auth/verify-otp', { email, otp }),
}

// ─── Cases ───────────────────────────────────────────────────
export const casesApi = {
  getAll:  (page = 0, size = 10) => api.get(`/cases?page=${page}&size=${size}`),
  getById: (id: string)          => api.get(`/cases/${id}`),
  create:  (data: { title: string; description: string }) => api.post('/cases', data),
  update:  (id: string, data: Partial<{ title: string; description: string; status: string }>) =>
                                     api.put(`/cases/${id}`, data),
}

// ─── Recognition ─────────────────────────────────────────────
export const recognitionApi = {
  run:       (caseId: string, imageBase64: string, maxFaces = 10, threshold = 40) =>
               api.post('/recognition/run', { caseId, imageBase64, maxFaces, threshold }),
  getByCase: (caseId: string) => api.get(`/recognition/case/${caseId}`),
}

export default api
