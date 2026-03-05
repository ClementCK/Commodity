import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function Layout() {
    const { profile, isAdmin, signOut } = useAuth()
    const { isDark, toggleTheme } = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    // Close sidebar on Escape key
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [sidebarOpen])

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
        : profile?.email?.[0]?.toUpperCase() || '?'

    return (
        <div className="app-layout">
            {/* Mobile header */}
            <div className="mobile-header">
                <h2>📊 CommodityTracker</h2>
                <button
                    className={`hamburger ${sidebarOpen ? 'open' : ''}`}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle navigation"
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>

            {/* Sidebar overlay (mobile) */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <h2>📊 CommodityTracker</h2>
                    <p>Deal Management</p>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" end>
                        <span className="nav-icon">📊</span> Dashboard
                    </NavLink>
                    <NavLink to="/kanban">
                        <span className="nav-icon">📋</span> Kanban Board
                    </NavLink>
                    <NavLink to="/assistant">
                        <span className="nav-icon">🤖</span> AI Assistant
                    </NavLink>
                    <NavLink to="/deals/new">
                        <span className="nav-icon">➕</span> New Deal
                    </NavLink>

                    {isAdmin && (
                        <>
                            <div className="sidebar-spacer" />
                            <NavLink to="/settings">
                                <span className="nav-icon">⚙️</span> Settings
                            </NavLink>
                        </>
                    )}

                    {!isAdmin && <div className="sidebar-spacer" />}

                    <button className="theme-toggle" onClick={toggleTheme} type="button">
                        <span className="nav-icon">{isDark ? '☀️' : '🌙'}</span>
                        {isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">{initials}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">
                                {profile?.full_name || profile?.email || 'User'}
                            </div>
                            <div className="sidebar-user-role">
                                {profile?.role || 'user'}
                            </div>
                        </div>
                    </div>
                    <button
                        className="sidebar-nav btn-ghost"
                        onClick={handleSignOut}
                        style={{ width: '100%', marginTop: 4 }}
                    >
                        <span className="nav-icon">🚪</span> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content with page animation */}
            <main className="main-content">
                <div key={location.pathname} className="page-enter">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
