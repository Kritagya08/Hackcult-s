import React, { useState, useEffect } from 'react'
import { Profile } from './types'
import { api } from './api'
import { FootprintScreen } from './screens/FootprintScreen'
import { GreenActionsScreen } from './screens/GreenActionsScreen'
import { CommunityImpactScreen } from './screens/CommunityImpactScreen'
import { SolarExplorerScreen } from './screens/SolarExplorerScreen'
import { WaterTrackerScreen } from './screens/WaterTrackerScreen'
import { ProfileModal } from './components/ProfileModal'
import {
  Zap,
  Leaf,
  Users,
  Sun,
  ShieldCheck,
  User,
  Droplets,
} from 'lucide-react'

type Screen = 'footprint' | 'water' | 'actions' | 'community' | 'solar'

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('footprint')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  // Load profile from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem('wattwise_profile_id')
    if (savedId) {
      api.getProfile(savedId)
        .then((p) => setProfile(p))
        .catch(() => {
          localStorage.removeItem('wattwise_profile_id')
        })
    }
  }, [])

  const handleProfileSelected = (newProfile: Profile) => {
    setProfile(newProfile)
    localStorage.setItem('wattwise_profile_id', newProfile.id)
  }

  const getScreenTitle = () => {
    switch (currentScreen) {
      case 'footprint':
        return 'My Footprint — Household Energy & Carbon'
      case 'actions':
        return 'Green Actions — Mission LiFE Challenges'
      case 'water':
        return 'Water Tracker — Household Conservation Awareness'
      case 'community':
        return 'Community Impact — Collective Leaderboard'
      case 'solar':
        return 'Solar Explorer — Rooftop Potential Estimator'
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">
            <Leaf size={22} />
          </div>
          <div className="brand-text">
            <h1>WattWise LiFE</h1>
            <span>Mission LiFE Citizen App</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${currentScreen === 'footprint' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('footprint')}
          >
            <Zap className="nav-icon" />
            <span>My Footprint</span>
          </button>

          <button
            className={`nav-item ${currentScreen === 'water' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('water')}
          >
            <Droplets className="nav-icon" />
            <span>Water Tracker</span>
          </button>

          <button
            className={`nav-item ${currentScreen === 'actions' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('actions')}
          >
            <Leaf className="nav-icon" />
            <span>Green Actions</span>
          </button>

          <button
            className={`nav-item ${currentScreen === 'community' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('community')}
          >
            <Users className="nav-icon" />
            <span>Community Impact</span>
          </button>

          <button
            className={`nav-item ${currentScreen === 'solar' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('solar')}
          >
            <Sun className="nav-icon" />
            <span>Solar Explorer</span>
          </button>
        </nav>

        {/* Profile Card in Sidebar Bottom */}
        <div className="sidebar-profile">
          <div className="profile-info">
            <div>
              <div className="profile-name">
                {profile ? profile.display_name : 'No Profile Active'}
              </div>
              <div className="profile-city">
                {profile ? (profile.city || 'Household') : 'Demo Mode'}
              </div>
            </div>
            <User size={18} color="var(--emerald-main)" />
          </div>

          <button className="btn-switch-profile" onClick={() => setIsProfileModalOpen(true)}>
            {profile ? 'Switch Profile' : '+ Create Profile'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-title">{getScreenTitle()}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="status-badge">
              <span className="status-dot"></span>
              <span>HC26-GEDA01 Sprint Live</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} color="var(--cyan-accent)" />
              <span>Mission LiFE India</span>
            </div>
          </div>
        </header>

        <main className="content-pane">
          {currentScreen === 'footprint' && (
            <FootprintScreen profile={profile} onOpenProfileModal={() => setIsProfileModalOpen(true)} />
          )}

          {currentScreen === 'actions' && (
            <GreenActionsScreen profile={profile} onOpenProfileModal={() => setIsProfileModalOpen(true)} />
          )}

          {currentScreen === 'water' && (
            <WaterTrackerScreen profile={profile} onOpenProfileModal={() => setIsProfileModalOpen(true)} />
          )}

          {currentScreen === 'community' && (
            <CommunityImpactScreen profile={profile} onOpenProfileModal={() => setIsProfileModalOpen(true)} />
          )}

          {currentScreen === 'solar' && (
            <SolarExplorerScreen />
          )}
        </main>
      </div>

      {/* Profile Creation / Switch Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSelected={handleProfileSelected}
        currentProfile={profile}
      />
    </div>
  )
}
export default App
