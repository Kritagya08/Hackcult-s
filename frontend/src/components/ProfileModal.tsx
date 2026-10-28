import React, { useState } from 'react'
import { Profile } from '../types'
import { api, ApiError } from '../api'
import { X, UserPlus, AlertCircle } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onProfileSelected: (profile: Profile) => void
  currentProfile: Profile | null
}

export const ProfileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onProfileSelected,
  currentProfile,
}) => {
  const [displayName, setDisplayName] = useState('')
  const [city, setCity] = useState('')
  const [householdSize, setHouseholdSize] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quick switch by ID state
  const [switchId, setSwitchId] = useState('')
  const [switchLoading, setSwitchLoading] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Please enter a display name or nickname.')
      return
    }
    if (householdSize && (!/^\d+$/.test(householdSize) || Number(householdSize) < 1)) {
      setError('Household size must be a positive whole number when provided.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const profile = await api.createProfile({
        display_name: displayName.trim(),
        city: city.trim() || null,
        household_size: householdSize ? Number(householdSize) : null,
      })
      onProfileSelected(profile)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to create profile.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchById = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!switchId.trim()) {
      setSwitchError('Please enter a Profile UUID.')
      return
    }

    setSwitchLoading(true)
    setSwitchError(null)

    try {
      const profile = await api.getProfile(switchId.trim())
      onProfileSelected(profile)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSwitchError(err.message)
      } else {
        setSwitchError('Profile not found.')
      }
    } finally {
      setSwitchLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {currentProfile ? 'Switch or Create Profile' : 'Create Household Profile'}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label" htmlFor="display-name">Household Nickname / Display Name</label>
            <input
              id="display-name"
              type="text"
              placeholder="e.g. Asha Household, GreenDen"
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={80}
            />
            <div className="form-help">For demo privacy, use a nickname rather than a full legal name.</div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="city-input">City / Region (Optional)</label>
            <input
              id="city-input"
              type="text"
              placeholder="e.g. Gandhinagar, Ahmedabad"
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="household-size-input">Household Size (Optional)</label>
            <input
              id="household-size-input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="e.g. 4"
              className="form-input"
              value={householdSize}
              onChange={(e) => setHouseholdSize(e.target.value)}
            />
            <div className="form-help">Used only for per-person water averages. Existing profiles remain valid without it.</div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            <UserPlus size={16} />
            {loading ? 'Creating Profile...' : 'Create New Profile'}
          </button>
        </form>

        {/* Option to load existing by UUID */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            Or Load Existing Profile by UUID
          </div>

          {switchError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{switchError}</span>
            </div>
          )}

          <form onSubmit={handleSwitchById} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Paste Profile UUID..."
              className="form-input"
              style={{ flex: 1, fontSize: '0.8rem' }}
              value={switchId}
              onChange={(e) => setSwitchId(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={switchLoading}>
              {switchLoading ? 'Loading...' : 'Load'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

