import React, { useState, useEffect } from 'react'
import { Profile, FootprintResponse, EnergyEntry } from '../types'
import { api, ApiError } from '../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Zap, TrendingDown, TrendingUp, AlertCircle, PlusCircle, CheckCircle, Info } from 'lucide-react'

interface Props {
  profile: Profile | null
  onOpenProfileModal: () => void
}

export const FootprintScreen: React.FC<Props> = ({ profile, onOpenProfileModal }) => {
  const [footprint, setFootprint] = useState<FootprintResponse | null>(null)
  const [entries, setEntries] = useState<EnergyEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form input state
  const [periodMonth, setPeriodMonth] = useState('')
  const [kwhInput, setKwhInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadData = async (profileId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [fpData, entriesData] = await Promise.all([
        api.getFootprint(profileId),
        api.getEnergyEntries(profileId, 50, 0),
      ])
      setFootprint(fpData)
      setEntries(entriesData.items)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load footprint data.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      loadData(profile.id)
    } else {
      setFootprint(null)
      setEntries([])
    }
  }, [profile])

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) {
      onOpenProfileModal()
      return
    }

    if (!periodMonth) {
      setSubmitError('Please select a month.')
      return
    }

    // Ensure format is YYYY-MM-01
    const normalizedMonth = periodMonth.length === 7 ? `${periodMonth}-01` : periodMonth

    const numKwh = parseFloat(kwhInput)
    if (isNaN(numKwh) || numKwh < 0) {
      setSubmitError('Please enter a valid non-negative kWh value.')
      return
    }

    const decimalKwh = numKwh.toFixed(2)

    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      await api.createEnergyEntry(profile.id, {
        period_month: normalizedMonth,
        electricity_kwh: decimalKwh,
      })
      setSubmitSuccess(`Recorded ${decimalKwh} kWh for ${normalizedMonth}`)
      setKwhInput('')
      setPeriodMonth('')
      await loadData(profile.id)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'ENTRY_EXISTS') {
          setSubmitError(`An entry already exists for month ${normalizedMonth}. Duplicate months are not allowed.`)
        } else {
          setSubmitError(err.message)
        }
      } else {
        setSubmitError('Failed to record energy entry.')
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
          To track your monthly electricity consumption and estimated carbon footprint, start by creating a profile.
        </p>
        <button className="btn btn-primary" onClick={onOpenProfileModal}>
          Create Profile
        </button>
      </div>
    )
  }

  const latestItem = footprint && footprint.items.length > 0 ? footprint.items[footprint.items.length - 1] : null
  const changePercent = footprint?.latest_change_percent ? parseFloat(footprint.latest_change_percent) : null

  return (
    <div>
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metrics Grid */}
      <div className="grid-3">
        <div className="card metric-box">
          <div className="card-subtitle">Latest Monthly Usage</div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>
            {latestItem ? latestItem.electricity_kwh : '—'}
            <span className="metric-unit">kWh</span>
          </div>
          {changePercent !== null && (
            <div className={`metric-trend ${changePercent > 0 ? 'trend-up' : changePercent < 0 ? 'trend-down' : 'trend-neutral'}`}>
              {changePercent > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(changePercent).toFixed(1)}% vs previous month
            </div>
          )}
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Estimated Footprint</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--cyan-accent)' }}>
            {latestItem ? latestItem.estimated_kg_co2e : '—'}
            <span className="metric-unit">kg CO₂e</span>
          </div>
          <div className="metric-trend trend-neutral">
            Factor: {footprint?.emissions_factor_kg_per_kwh || '0.7000'} kg/kWh (demo assumption)
          </div>
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Recorded Periods</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--emerald-main)' }}>
            {entries.length}
            <span className="metric-unit">months</span>
          </div>
          <div className="metric-trend trend-neutral">
            Household: {profile.display_name} {profile.city ? `(${profile.city})` : ''}
          </div>
        </div>
      </div>

      {/* Main Content 2-column: Chart & Input Form */}
      <div className="grid-2">
        {/* Footprint Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Zap size={18} color="var(--emerald-main)" />
                Consumption & Footprint Trend
              </div>
              <div className="card-subtitle">Monthly electricity usage and estimated carbon emissions</div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading data...</div>
          ) : footprint && footprint.items.length > 0 ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={footprint.items} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#20335e" />
                  <XAxis dataKey="period_month" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111d38', borderColor: '#20335e', color: '#f8fafc', borderRadius: 8 }}
                    formatter={(val: string, name: string) => [
                      `${val} ${name === 'electricity_kwh' ? 'kWh' : 'kg CO₂e'}`,
                      name === 'electricity_kwh' ? 'Electricity' : 'Est. CO₂e',
                    ]}
                  />
                  <Line type="monotone" dataKey="electricity_kwh" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="electricity_kwh" />
                  <Line type="monotone" dataKey="estimated_kg_co2e" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="4 4" name="estimated_kg_co2e" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>No monthly consumption recorded yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Add your latest electricity bill below.</p>
            </div>
          )}

          <div className="disclaimer-box">
            <strong>Important Methodology Note:</strong> {footprint?.assumption_note || 'The emissions factor (0.7000 kg CO₂e/kWh) is an illustrative demo assumption, NOT a verified regional/grid factor. No measured CO₂ savings or official audit is claimed.'}
          </div>
        </div>

        {/* Entry Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <PlusCircle size={18} color="var(--emerald-main)" />
                Record Monthly Electricity Usage
              </div>
              <div className="card-subtitle">Enter your meter reading or billed consumption</div>
            </div>
          </div>

          {submitError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="success-banner">
              <CheckCircle size={16} />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAddEntry}>
            <div className="form-group">
              <label className="form-label" htmlFor="period-month-input">Billing Month (YYYY-MM)</label>
              <input
                id="period-month-input"
                type="month"
                className="form-input"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                required
              />
              <div className="form-help">Normalized to the 1st of the month (YYYY-MM-01) per contract.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="kwh-input">Electricity Consumption (kWh)</label>
              <input
                id="kwh-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 220.00"
                className="form-input"
                value={kwhInput}
                onChange={(e) => setKwhInput(e.target.value)}
                required
              />
              <div className="form-help">Stored with 2 decimal precision. Non-negative values only.</div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Saving...' : 'Record Consumption'}
            </button>
          </form>
        </div>
      </div>

      {/* History Table */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Persisted Electricity History</div>
            <div className="card-subtitle">All recorded monthly consumption entries (newest first)</div>
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Electricity (kWh)</th>
                  <th>Recorded At (UTC)</th>
                  <th>Entry ID</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.period_month}</strong></td>
                    <td style={{ color: 'var(--emerald-main)', fontWeight: 600 }}>{entry.electricity_kwh} kWh</td>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No entries found for this profile.</p>
          </div>
        )}
      </div>
    </div>
  )
}

