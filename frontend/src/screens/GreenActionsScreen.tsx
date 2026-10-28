import React, { useState, useEffect } from 'react'
import { Profile, Challenge, Completion, Nudge } from '../types'
import { api, ApiError } from '../api'
import { Award, CheckCircle, AlertCircle, Sparkles, Lightbulb, Calendar } from 'lucide-react'

interface Props {
  profile: Profile | null
  onOpenProfileModal: () => void
}

export const GreenActionsScreen: React.FC<Props> = ({ profile, onOpenProfileModal }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'ENERGY' | 'WATER'>('ALL')

  // Completion action state
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] // YYYY-MM-DD
  })

  const loadData = async (profileId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [chData, compData, nudgeData] = await Promise.all([
        api.getChallenges(50, 0),
        api.getCompletions(profileId, 50, 0),
        api.getNudges(profileId),
      ])
      setChallenges(chData.items)
      setCompletions(compData.items)
      setNudges(nudgeData.items)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load actions and challenges.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      loadData(profile.id)
    } else {
      // Still load public challenges if no profile
      api.getChallenges(50, 0)
        .then((res) => setChallenges(res.items))
        .catch(() => {})
      setCompletions([])
      setNudges([])
    }
  }, [profile])

  const handleComplete = async (challenge: Challenge) => {
    if (!profile) {
      onOpenProfileModal()
      return
    }

    setCompletingId(challenge.id)
    setActionError(null)
    setActionSuccess(null)

    try {
      const completion = await api.createCompletion(profile.id, {
        challenge_id: challenge.id,
        completed_on: selectedDate,
      })
      setActionSuccess(`Completed "${challenge.title}"! +${completion.points} points awarded.`)
      await loadData(profile.id)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'ALREADY_COMPLETED') {
          setActionError(`You have already completed "${challenge.title}" on ${selectedDate}. Duplicate completions on the same date are not allowed.`)
        } else {
          setActionError(err.message)
        }
      } else {
        setActionError('Failed to record challenge completion.')
      }
    } finally {
      setCompletingId(null)
    }
  }

  // Calculate total derived points from completions
  const totalPoints = completions.reduce((acc, c) => acc + (c.points || 0), 0)

  // Check if a challenge was already completed on selectedDate
  const isCompletedOnDate = (challengeId: string) => {
    return completions.some(
      (c) => c.challenge_id === challengeId && c.completed_on === selectedDate
    )
  }

  const visibleChallenges = categoryFilter === 'ALL'
    ? challenges
    : challenges.filter((challenge) => challenge.category === categoryFilter)

  return (
    <div>
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="success-banner">
          <CheckCircle size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Top Banner Stats */}
      <div className="grid-3">
        <div className="card metric-box">
          <div className="card-subtitle">Derived Mission LiFE Points</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--emerald-main)' }}>
            {totalPoints}
            <span className="metric-unit">pts</span>
          </div>
          <div className="metric-trend trend-neutral">
            Strictly derived by server join from saved completions
          </div>
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Tasks Completed</div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>
            {completions.length}
            <span className="metric-unit">actions</span>
          </div>
          <div className="metric-trend trend-neutral">
            User-reported (not independently verified)
          </div>
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Active Catalog</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--cyan-accent)' }}>
            {challenges.length}
            <span className="metric-unit">challenges</span>
          </div>
          <div className="metric-trend trend-neutral">
            Daily sustainable habits
          </div>
        </div>
      </div>

      {/* Nudges Section */}
      {nudges.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <Lightbulb size={18} color="var(--amber-accent)" />
                Server-Driven Personalized Energy Nudges
              </div>
              <div className="card-subtitle">Deterministic tips based on your latest recorded electricity trend</div>
            </div>
          </div>
          <div>
            {nudges.map((nudge, idx) => (
              <div key={idx} className="nudge-card">
                <div className="nudge-title">{nudge.title}</div>
                <div className="nudge-msg">{nudge.message}</div>
                <div className="nudge-reason">Reason: {nudge.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge Catalog Section */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="card-title">
              <Sparkles size={18} color="var(--emerald-main)" />
              Mission LiFE Sustainability Challenges
            </div>
            <div className="card-subtitle">
              Micro-actions to adopt sustainable lifestyle habits. One completion per task per day.
            </div>
          </div>

          {/* Date Picker for Task Completion */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <label htmlFor="log-date" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log Date:</label>
            <input
              id="log-date"
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-tabs" aria-label="Challenge category filters">
          {(['ALL', 'ENERGY', 'WATER'] as const).map((category) => (
            <button
              key={category}
              type="button"
              className={`filter-tab ${categoryFilter === category ? 'active' : ''}`}
              onClick={() => setCategoryFilter(category)}
              aria-pressed={categoryFilter === category}
            >
              {category === 'ALL' ? 'All Actions' : category === 'ENERGY' ? 'Energy' : 'Water'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">Loading active challenges...</div>
        ) : visibleChallenges.length > 0 ? (
          <div className="grid-3" style={{ marginTop: '1rem', marginBottom: '0' }}>
            {visibleChallenges.map((ch) => {
              const completedToday = isCompletedOnDate(ch.id)
              const isBusy = completingId === ch.id

              return (
                <div key={ch.id} className="challenge-item">
                  <div>
                    <div className="challenge-badge">
                      <Award size={14} /> +{ch.points} Points
                    </div>
                    <div className={`category-badge ${ch.category.toLowerCase()}`}>{ch.category}</div>
                    <div className="challenge-title">{ch.title}</div>
                    <div className="challenge-desc">{ch.description}</div>
                  </div>

                  <button
                    className={`btn ${completedToday ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%', marginTop: 'auto' }}
                    onClick={() => handleComplete(ch)}
                    disabled={completedToday || isBusy}
                  >
                    {completedToday ? (
                      <>
                        <CheckCircle size={16} /> Completed on {selectedDate}
                      </>
                    ) : isBusy ? (
                      'Recording...'
                    ) : (
                      'Complete Action'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>No active challenges in catalog.</p>
          </div>
        )}
      </div>

      {/* Completion History */}
      {profile && completions.length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity Log</div>
              <div className="card-subtitle">History of self-reported task completions for {profile.display_name}</div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Completed On</th>
                  <th>Challenge</th>
                  <th>Points</th>
                  <th>Logged At (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {completions.map((comp) => (
                  <tr key={comp.id}>
                    <td><strong>{comp.completed_on}</strong></td>
                    <td>{comp.challenge?.title || `Task (${comp.challenge_id.slice(0, 8)}...)`}</td>
                    <td style={{ color: 'var(--emerald-main)', fontWeight: 600 }}>+{comp.points}</td>
                    <td>{new Date(comp.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

