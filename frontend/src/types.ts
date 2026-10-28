export interface Profile {
  id: string
  display_name: string
  city: string | null
  created_at: string
}

export interface ProfileCreateRequest {
  display_name: string
  city?: string | null
  household_size?: number | null
}

export interface EnergyEntry {
  id: string
  profile_id: string
  period_month: string // YYYY-MM-01
  electricity_kwh: string // Decimal string e.g. "220.00"
  created_at: string
}

export interface EnergyEntryCreateRequest {
  period_month: string
  electricity_kwh: string
}

export interface PaginatedResponse<T> {
  items: T[]
  limit: number
  offset: number
  total: number
}

export interface FootprintItem {
  period_month: string
  electricity_kwh: string
  estimated_kg_co2e: string
}

export interface FootprintResponse {
  profile_id: string
  emissions_factor_kg_per_kwh: string // "0.7000"
  items: FootprintItem[]
  latest_change_percent: string | null
  assumption_note: string
}

export interface Challenge {
  id: string
  code: string
  title: string
  description: string
  points: number
  active: boolean
  category: 'ENERGY' | 'WATER'
}

export interface WaterEntry {
  id: string
  profile_id: string
  month: string
  litres: string
  created_at: string
}

export interface WaterEntryCreateRequest {
  month: string
  litres: string
}

export interface WaterSummary {
  latest_month: string | null
  latest_month_litres: string | null
  daily_household_average_litres: string | null
  per_person_daily_average_litres: string | null
  previous_month_litres: string | null
  month_over_month_change_percent: string | null
  monthly_history: WaterEntry[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  current_progress: number
  target: number
}

export interface StreakResponse {
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  active_dates_for_recent_week: string[]
}

export interface Completion {
  id: string
  profile_id: string
  challenge_id: string
  completed_on: string // YYYY-MM-DD
  created_at: string
  challenge?: Challenge
  points: number
}

export interface CompletionCreateRequest {
  challenge_id: string
  completed_on: string
}

export interface LeaderboardEntry {
  profile_id: string
  display_name: string
  points: number
  completed_count: number
}

export interface Nudge {
  code: string
  title: string
  message: string
  reason: string
}

export interface SolarEstimateRequest {
  roof_area_m2: string
  electricity_tariff_inr_per_kwh: string
}

export interface SolarEstimateResponse {
  roof_area_m2: string
  estimated_capacity_kwp: string
  estimated_annual_generation_kwh: string
  estimated_annual_energy_value_inr: string
  assumptions: {
    area_m2_per_kwp: string
    daily_kwh_per_kwp: string
    days_per_year: number
  }
  disclaimer: string
}

export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details: unknown[]
  }
}

