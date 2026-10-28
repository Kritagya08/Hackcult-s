import React, { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, CheckCircle, Droplets, Info, PlusCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { ApiError, api } from '../api'
import { Profile, WaterEntry, WaterSummary } from '../types'

interface Props {
  profile: Profile | null
  onOpenProfileModal: () => void
}

const decimalPattern = /^(0|[1-9]\d*)\.\d{2}$/

export const WaterTrackerScreen: React.FC<Props> = ({ profile, onOpenProfileModal }) => {
  const [summary, setSummary] = useState<WaterSummary | null>(null)
  const [entries, setEntries] = useState<WaterEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState('')
  const [litres, setLitres] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const loadData = async (profileId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, entriesData] = await Promise.all([
        api.getWaterSummary(profileId),
        api.getWaterEntries(profileId, 50, 0),
      ])
      setSummary(summaryData)
      setEntries(entriesData.items)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to load water consumption data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      void loadData(profile.id)
    } else {
      setSummary(null)
      setEntries([])
      setError(null)
    }
  }, [profile])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) {
      onOpenProfileModal()
      return
    }
    if (!month) {
      setSubmitError('Please select a reporting month.')
      return
    }
    if (!decimalPattern.test(litres) || Number(litres) <= 0) {
      setSubmitError('Enter a positive litres value with exactly two decimal places, such as 12000.00.')
      return
    }

    const normalizedMonth = `${month}-01`
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      await api.createWaterEntry(profile.id, { month: normalizedMonth, litres })
      setSubmitSuccess(`Recorded ${litres} litres for ${normalizedMonth}.`)
      setMonth('')
      setLitres('')
      await loadData(profile.id)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'WATER_ENTRY_EXISTS') {
        setSubmitError(`Water consumption is already recorded for ${normalizedMonth}.`)
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'Failed to save water consumption.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!profile) {
    return (
      <div className="card empty-state">
        <Info className="empty-icon" />
        <h2>Select or Create a Household Profile</h2>
        <p style={{ marginTop: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          A profile is required to record monthly household water consumption.
        </p>
        <button className="btn btn-primary" onClick={onOpenProfileModal}>Create Profile</button>
      </div>
    )
  }

  const change = summary?.month_over_month_change_percent === null || summary?.month_over_month_change_percent === undefined
    ? null
    : Number(summary.month_over_month_change_percent)
  const chartData = (summary?.monthly_history ?? []).map((entry) => ({
    month: entry.month.slice(0, 7),
    litres: Number(entry.litres),
  }))

  return (
    <div>
      {error && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

      <div className="grid-3">
        <div className="card metric-box">
          <div className="card-subtitle">Latest Monthly Consumption</div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>
            {summary?.latest_month_litres ?? '—'}<span className="metric-unit">litres</span>
          </div>
          <div className="metric-trend trend-neutral">{summary?.latest_month ?? 'No month recorded'}</div>
        </div>
        <div className="card metric-box">
          <div className="card-subtitle">Daily Household Average</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--cyan-accent)' }}>
            {summary?.daily_household_average_litres ?? '—'}<span className="metric-unit">L/day</span>
          </div>
          <div className="metric-trend trend-neutral">Uses actual calendar days in the latest month</div>
        </div>
        <div className="card metric-box">
          <div className="card-subtitle">Per-Person Daily Average</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--emerald-main)' }}>
            {summary?.per_person_daily_average_litres ?? '—'}<span className="metric-unit">L/person/day</span>
          </div>
          <div className="metric-trend trend-neutral">
            {summary?.per_person_daily_average_litres ? 'Based on saved household size' : 'Household size unavailable'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Droplets size={18} color="var(--cyan-accent)" />Water Consumption History</div>
              <div className="card-subtitle">Persisted monthly household consumption; no missing months are invented</div>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">Loading water history...</div>
          ) : chartData.length ? (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#20335e" />
                  <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111d38', borderColor: '#20335e', color: '#f8fafc', borderRadius: 8 }}
                    formatter={(value: number) => [`${value.toFixed(2)} litres`, 'Consumption']}
                  />
                  <Bar dataKey="litres" fill="#06b6d4" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state"><Droplets className="empty-icon" /><p>No water history recorded yet.</p></div>
          )}

          <div className="water-comparison">
            <div>
              <span>Previous calendar month</span>
              <strong>{summary?.previous_month_litres ? `${summary.previous_month_litres} litres` : 'Not recorded'}</strong>
            </div>
            <div>
              <span>Month-over-month change</span>
              <strong className={change === null ? 'trend-neutral' : change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-neutral'}>
                {change === null ? 'Not calculable' : (
                  <>{change > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{Math.abs(change).toFixed(2)}% {change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no change'}</>
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><PlusCircle size={18} color="var(--emerald-main)" />Record Monthly Water Use</div>
              <div className="card-subtitle">Enter the household total shown on your bill or meter record</div>
            </div>
          </div>
          {submitError && <div className="error-banner" role="alert"><AlertCircle size={16} /><span>{submitError}</span></div>}
          {submitSuccess && <div className="success-banner" role="status"><CheckCircle size={16} /><span>{submitSuccess}</span></div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="water-month">Reporting Month</label>
              <input id="water-month" type="month" className="form-input" value={month} onChange={(e) => setMonth(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="water-litres">Consumption (litres)</label>
              <input
                id="water-litres"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12000.00"
                className="form-input"
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                required
              />
              <div className="form-help">Positive value with exactly two decimal places. This records consumption, not claimed savings.</div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Water Consumption'}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header"><div><div className="card-title">Persisted Water History</div><div className="card-subtitle">Newest recorded month first</div></div></div>
        {entries.length ? (
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Month</th><th>Consumption</th><th>Recorded At</th></tr></thead>
              <tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.month}</strong></td><td style={{ color: 'var(--cyan-accent)', fontWeight: 600 }}>{entry.litres} litres</td><td>{new Date(entry.created_at).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <div className="empty-state">No water entries found for this profile.</div>}
      </div>
    </div>
  )
}
