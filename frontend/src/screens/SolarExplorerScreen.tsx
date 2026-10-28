import React, { useState } from 'react'
import { SolarEstimateResponse } from '../types'
import { api, ApiError } from '../api'
import { Sun, Calculator, AlertCircle, Info, CheckCircle2 } from 'lucide-react'

export const SolarExplorerScreen: React.FC = () => {
  // Input fields
  const [roofArea, setRoofArea] = useState('30.00')
  const [tariff, setTariff] = useState('8.00')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<SolarEstimateResponse | null>(null)

  const handleEstimate = async (e: React.FormEvent) => {
    e.preventDefault()

    const areaNum = parseFloat(roofArea)
    const tariffNum = parseFloat(tariff)

    if (isNaN(areaNum) || areaNum <= 0) {
      setError('Please enter a valid positive roof area in square meters.')
      return
    }

    if (isNaN(tariffNum) || tariffNum < 0) {
      setError('Please enter a valid non-negative electricity tariff in INR/kWh.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await api.estimateSolar({
        roof_area_m2: areaNum.toFixed(2),
        electricity_tariff_inr_per_kwh: tariffNum.toFixed(2),
      })
      setEstimate(res)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to compute solar estimate.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid-2">
        {/* Left Column: Calculation Parameters */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Sun size={18} color="var(--amber-accent)" />
                Rooftop Solar Estimator
              </div>
              <div className="card-subtitle">
                Calculate potential solar capacity and generation based on available roof area
              </div>
            </div>
          </div>

          <form onSubmit={handleEstimate}>
            <div className="form-group">
              <label className="form-label" htmlFor="roof-area">Available Shadow-Free Rooftop Area (m²)</label>
              <input
                id="roof-area"
                type="number"
                step="0.01"
                min="1"
                className="form-input"
                value={roofArea}
                onChange={(e) => setRoofArea(e.target.value)}
                required
              />
              <div className="form-help">Typical residential terrace: 25 - 100 m². Standard benchmark: 6 m² per kWp.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tariff">Grid Electricity Tariff (INR / kWh)</label>
              <input
                id="tariff"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                required
              />
              <div className="form-help">Average residential DISCOM retail tariff (e.g. ₹8.00 / kWh in urban India).</div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              <Calculator size={16} />
              {loading ? 'Calculating...' : 'Compute Solar Potential'}
            </button>
          </form>

          <div className="disclaimer-box" style={{ marginTop: '1.5rem' }}>
            <Info size={16} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'text-bottom' }} />
            <strong>Assumptions Disclosed:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem' }}>
              <li>Solar capacity density: 6.00 m² per kWp</li>
              <li>Daily solar generation yield: 4.00 kWh per kWp</li>
              <li>Standard operating baseline: 365 days per year</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Estimated Outputs */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <CheckCircle2 size={18} color="var(--emerald-main)" />
                Illustrative Potential
              </div>
              <div className="card-subtitle">Server-evaluated generation and energy value</div>
            </div>
          </div>

          {estimate ? (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated System Capacity</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--amber-accent)', marginTop: '0.25rem' }}>
                    {estimate.estimated_capacity_kwp} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kWp</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Based on {estimate.roof_area_m2} m² of shadow-free rooftop
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Annual Generation</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--emerald-main)', marginTop: '0.25rem' }}>
                    {estimate.estimated_annual_generation_kwh} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kWh / year</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    ~{(parseFloat(estimate.estimated_annual_generation_kwh) / 12).toFixed(0)} kWh average monthly clean power
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Illustrative Annual Electricity Value</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--cyan-accent)', marginTop: '0.25rem' }}>
                    ₹ {estimate.estimated_annual_energy_value_inr}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Displaced grid power value at ₹{tariff}/kWh
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  fontSize: '0.775rem',
                  color: '#fecdd3',
                  lineHeight: '1.4',
                }}
              >
                <strong>Contractual Disclaimer:</strong> {estimate.disclaimer}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Sun className="empty-icon" />
              <p>Enter your rooftop area and click "Compute Solar Potential".</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Quick check: 30 m² at ₹8.00/kWh yields 5.00 kWp, 7,300.00 kWh/yr, and ₹58,400.00 value.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

