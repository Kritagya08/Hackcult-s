import React, { useState, useEffect } from 'react'
import { Achievement, Completion, LeaderboardEntry, Profile, StreakResponse } from '../types'
import { api, ApiError } from '../api'
import { Trophy, Users, Award, AlertCircle, RefreshCw, BadgeCheck, Lock, Flame } from 'lucide-react'

interface Props {
  profile: Profile | null
  onOpenProfileModal: () => void
}

export const CommunityImpactScreen: React.FC<Props> = ({ profile, onOpenProfileModal }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak] = useState<StreakResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (profile) {
        const [lbData, compData, achievementData, streakData] = await Promise.all([
          api.getLeaderboard(20, 0),
          api.getCompletions(profile.id, 50, 0),
          api.getAchievements(profile.id),
          api.getStreak(profile.id),
        ])
        setLeaderboard(lbData.items)
        setCompletions(compData.items)
        setAchievements(achievementData.items)
        setStreak(streakData)
      } else {
        const lbData = await api.getLeaderboard(20, 0)
        setLeaderboard(lbData.items)
        setCompletions([])
        setAchievements([])
        setStreak(null)
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load community leaderboard.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [profile])

  // Collective metrics calculated from leaderboard
  const totalCommunityPoints = leaderboard.reduce((acc, row) => acc + row.points, 0)
  const totalCommunityActions = leaderboard.reduce((acc, row) => acc + row.completed_count, 0)

  // Find user's rank if in leaderboard
  const userRankIndex = profile ? leaderboard.findIndex((r) => r.profile_id === profile.id) : -1
  const kolkataToday = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
    return `${part('year')}-${part('month')}-${part('day')}`
  })()
  const recentWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${kolkataToday}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })

  return (
    <div>
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Community Top Stats */}
      <div className="grid-3">
        <div className="card metric-box">
          <div className="card-subtitle">Collective Mission LiFE Points</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--emerald-main)' }}>
            {totalCommunityPoints}
            <span className="metric-unit">pts</span>
          </div>
          <div className="metric-trend trend-neutral">
            Accumulated by community citizens
          </div>
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Total Sustainable Actions</div>
          <div className="metric-value" style={{ marginTop: '0.5rem', color: 'var(--cyan-accent)' }}>
            {totalCommunityActions}
            <span className="metric-unit">actions</span>
          </div>
          <div className="metric-trend trend-neutral">
            Self-reported micro-habits logged
          </div>
        </div>

        <div className="card metric-box">
          <div className="card-subtitle">Your Community Standing</div>
          <div className="metric-value" style={{ marginTop: '0.5rem' }}>
            {userRankIndex !== -1 ? `#${userRankIndex + 1}` : profile ? 'Unranked' : '—'}
          </div>
          <div className="metric-trend trend-neutral">
            {profile ? `Logged in as ${profile.display_name}` : 'Create a profile to join'}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Trophy size={18} color="var(--amber-accent)" />
              Citizen Impact Leaderboard
            </div>
            <div className="card-subtitle">
              Calculated strictly from persisted completions. Sorted by points DESC, display_name ASC.
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading leaderboard...</div>
        ) : leaderboard.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Citizen Nickname</th>
                  <th>Completed Actions</th>
                  <th>Derived Points</th>
                  <th>Profile ID</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const isCurrent = profile && entry.profile_id === profile.id
                  return (
                    <tr
                      key={entry.profile_id}
                      style={{
                        backgroundColor: isCurrent ? 'var(--emerald-subtle)' : undefined,
                        fontWeight: isCurrent ? 600 : undefined,
                      }}
                    >
                      <td>
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                      </td>
                      <td>
                        <strong>{entry.display_name}</strong>
                        {isCurrent && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: 'var(--emerald-main)',
                              background: 'var(--bg-secondary)',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            You
                          </span>
                        )}
                      </td>
                      <td>{entry.completed_count}</td>
                      <td style={{ color: 'var(--emerald-main)', fontWeight: 700 }}>
                        {entry.points} pts
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {entry.profile_id.slice(0, 12)}...
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Users className="empty-icon" />
            <p>No completions recorded in the leaderboard yet.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Complete tasks in Green Actions to appear on the community board!
            </p>
          </div>
        )}

        <div className="disclaimer-box">
          <strong>Community & Privacy Note:</strong> Display names are community nicknames for demo privacy. Challenge completions and points are derived directly from database joins without client overrides.
        </div>
      </div>

      {profile ? (
        <div className="grid-2" style={{ marginTop: '2rem' }}>
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><BadgeCheck size={18} color="var(--emerald-main)" />Green Badges</div>
                <div className="card-subtitle">Deterministically calculated from persisted activity</div>
              </div>
            </div>
            <div className="achievement-list">
              {achievements.map((achievement) => {
                const progress = Math.min(100, (achievement.current_progress / achievement.target) * 100)
                return (
                  <article key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
                    <div className="achievement-icon" aria-hidden="true">
                      {achievement.unlocked ? <BadgeCheck size={22} /> : <Lock size={20} />}
                    </div>
                    <div className="achievement-content">
                      <div className="achievement-title-row">
                        <strong>{achievement.title}</strong>
                        <span>{achievement.unlocked ? 'Unlocked' : 'Locked'}</span>
                      </div>
                      <p>{achievement.description}</p>
                      <div className="progress-track" aria-label={`${achievement.title}: ${achievement.current_progress} of ${achievement.target}`}>
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <small>{achievement.current_progress} / {achievement.target}</small>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><Flame size={18} color="var(--amber-accent)" />Daily Green Streak</div>
                <div className="card-subtitle">Distinct challenge-active days using Asia/Kolkata dates</div>
              </div>
            </div>
            <div className="streak-metrics">
              <div><span>Current streak</span><strong>{streak?.current_streak ?? 0} days</strong></div>
              <div><span>Longest streak</span><strong>{streak?.longest_streak ?? 0} days</strong></div>
              <div><span>Last active</span><strong>{streak?.last_active_date ?? 'No activity yet'}</strong></div>
            </div>
            <div className="week-activity" aria-label="Recent seven-day activity">
              {recentWeek.map((date) => {
                const active = streak?.active_dates_for_recent_week.includes(date) ?? false
                return (
                  <div key={date} className={`day-indicator ${active ? 'active' : ''}`} title={date}>
                    <span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}</span>
                    <b aria-label={`${date}: ${active ? 'active' : 'inactive'}`}>{active ? '✓' : '·'}</b>
                    <small>{date.slice(8)}</small>
                  </div>
                )
              })}
            </div>
            <div className="disclaimer-box">Multiple challenge completions on one calendar day count once toward the streak.</div>
          </section>
        </div>
      ) : (
        <div className="card empty-state" style={{ marginTop: '2rem' }}>
          <BadgeCheck className="empty-icon" />
          <p>Create or select a profile to view achievements and the Daily Green Streak.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onOpenProfileModal}>Create Profile</button>
        </div>
      )}

      {/* Profile's Contribution Detail */}
      {profile && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <Award size={18} color="var(--emerald-main)" />
                Your Sustainability Contribution ({profile.display_name})
              </div>
              <div className="card-subtitle">Summary of your personal engagement in the collective effort</div>
            </div>
            {!profile && (
              <button className="btn btn-secondary btn-sm" onClick={onOpenProfileModal}>
                Switch Profile
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actions Logged</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{completions.length}</div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Points Earned</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--emerald-main)', marginTop: '0.25rem' }}>
                {completions.reduce((acc, c) => acc + (c.points || 0), 0)} pts
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered City</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--cyan-accent)', marginTop: '0.25rem' }}>
                {profile.city || 'Not specified'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

