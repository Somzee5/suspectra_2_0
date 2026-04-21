export type UserRole = 'INVESTIGATOR' | 'FORENSIC_ANALYST' | 'ADMIN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
}

export interface AuthResponse {
  token: string
  user: User
}

export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED'

export interface Case {
  id: string
  title: string
  description: string
  status: CaseStatus
  createdBy: User
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}
