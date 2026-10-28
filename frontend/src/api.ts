import {
  Profile,
  ProfileCreateRequest,
  EnergyEntry,
  EnergyEntryCreateRequest,
  PaginatedResponse,
  FootprintResponse,
  Challenge,
  Completion,
  CompletionCreateRequest,
  LeaderboardEntry,
  Nudge,
  SolarEstimateRequest,
  SolarEstimateResponse,
  ApiErrorEnvelope,
  WaterEntry,
  WaterEntryCreateRequest,
  WaterSummary,
  Achievement,
  StreakResponse,
} from './types'

const API_BASE = 'http://127.0.0.1:8000/api/v1'

export class ApiError extends Error {
  code: string
  details: unknown[]
  status: number

  constructor(code: string, message: string, details: unknown[] = [], status = 400) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  let response: Response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    throw new ApiError(
      'NETWORK_ERROR',
      `Cannot connect to WattWise API backend at ${API_BASE}. Ensure backend server is running. (${errorMsg})`,
      [],
      0
    )
  }

  if (!response.ok) {
    let errorData: ApiErrorEnvelope | null = null
    try {
      errorData = await response.json()
    } catch {
      // not JSON
    }

    if (errorData && errorData.error) {
      throw new ApiError(
        errorData.error.code || 'API_ERROR',
        errorData.error.message || `Request failed with status ${response.status}`,
        errorData.error.details || [],
        response.status
      )
    }

    throw new ApiError(
      'HTTP_ERROR',
      `Request failed with status ${response.status}: ${response.statusText}`,
      [],
      response.status
    )
  }

  return response.json() as Promise<T>
}

export const api = {
  // Profiles
  createProfile: (data: ProfileCreateRequest): Promise<Profile> =>
    request<Profile>('/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getProfile: (profileId: string): Promise<Profile> =>
    request<Profile>(`/profiles/${profileId}`),

  // Energy Entries
  createEnergyEntry: (profileId: string, data: EnergyEntryCreateRequest): Promise<EnergyEntry> =>
    request<EnergyEntry>(`/profiles/${profileId}/energy-entries`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEnergyEntries: (profileId: string, limit = 50, offset = 0): Promise<PaginatedResponse<EnergyEntry>> =>
    request<PaginatedResponse<EnergyEntry>>(`/profiles/${profileId}/energy-entries?limit=${limit}&offset=${offset}`),

  // Water Entries
  createWaterEntry: (profileId: string, data: WaterEntryCreateRequest): Promise<WaterEntry> =>
    request<WaterEntry>(`/profiles/${profileId}/water-entries`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getWaterEntries: (profileId: string, limit = 50, offset = 0): Promise<PaginatedResponse<WaterEntry>> =>
    request<PaginatedResponse<WaterEntry>>(`/profiles/${profileId}/water-entries?limit=${limit}&offset=${offset}`),

  getWaterSummary: (profileId: string): Promise<WaterSummary> =>
    request<WaterSummary>(`/profiles/${profileId}/water-summary`),

  // Footprint
  getFootprint: (profileId: string): Promise<FootprintResponse> =>
    request<FootprintResponse>(`/profiles/${profileId}/footprint`),

  // Challenges
  getChallenges: (limit = 50, offset = 0): Promise<PaginatedResponse<Challenge>> =>
    request<PaginatedResponse<Challenge>>(`/challenges?limit=${limit}&offset=${offset}`),

  // Completions
  createCompletion: (profileId: string, data: CompletionCreateRequest): Promise<Completion> =>
    request<Completion>(`/profiles/${profileId}/completions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCompletions: (profileId: string, limit = 50, offset = 0): Promise<PaginatedResponse<Completion>> =>
    request<PaginatedResponse<Completion>>(`/profiles/${profileId}/completions?limit=${limit}&offset=${offset}`),

  // Leaderboard
  getLeaderboard: (limit = 20, offset = 0): Promise<PaginatedResponse<LeaderboardEntry>> =>
    request<PaginatedResponse<LeaderboardEntry>>(`/leaderboard?limit=${limit}&offset=${offset}`),

  // Nudges
  getNudges: (profileId: string): Promise<{ items: Nudge[] }> =>
    request<{ items: Nudge[] }>(`/profiles/${profileId}/nudges`),

  // Achievements and streaks
  getAchievements: (profileId: string): Promise<{ items: Achievement[] }> =>
    request<{ items: Achievement[] }>(`/profiles/${profileId}/achievements`),

  getStreak: (profileId: string): Promise<StreakResponse> =>
    request<StreakResponse>(`/profiles/${profileId}/streak`),

  // Solar Estimate
  estimateSolar: (data: SolarEstimateRequest): Promise<SolarEstimateResponse> =>
    request<SolarEstimateResponse>('/solar/estimate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

