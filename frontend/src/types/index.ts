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

// ── Pipeline / Aging ──────────────────────────────────────────

export interface PipelineSuspectMatch {
  suspectId:      string
  name:           string
  age?:           number
  gender?:        string
  crimeType?:     string
  description?:   string
  embeddingScore: number
  finalScore:     number
  confidence:     number
  sourceVariant:  string
}

export interface PipelineVariant {
  ageDelta:  number
  imageb64:  string
  faceFound: boolean
  matches:   PipelineSuspectMatch[]
}

export interface PipelineResult {
  id?:           string
  caseId?:       string
  ageSteps?:     number[]
  variants:      PipelineVariant[]
  bestMatch:     PipelineSuspectMatch | null
  sourceVariant: string | null
  totalMatches:  number
  createdAt?:    string
  error?:        string
  backend?:      string
}

export interface AgingRunSummary {
  id:             string
  caseId:         string
  ageSteps?:      number[]
  bestMatch?:     { suspectId: string; name: string; finalScore: number; sourceVariant: string }
  sourceVariant?: string
  totalMatches:   number
  createdAt:      string
}

export interface RecognitionRunSummary {
  id:        string
  caseId:    string
  total:     number
  createdAt: string
  matches:   Array<{
    suspectId:     string
    name:          string
    finalScore:    number
    awsSimilarity: number
    embeddingScore: number
  }>
}
