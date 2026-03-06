import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
    const [deals, setDeals] = useState([])
    const [stats, setStats] = useState({ total: 0, unassigned: 0, inProgress: 0, done: 0 })
    const [loading, setLoading] = useState(true)
    const [viewAll, setViewAll] = useState(false)
    const [profiles, setProfiles] = useState({})
    const navigate = useNavigate()
    const { user, isAdmin } = useAuth()

    useEffect(() => {
        if (user) loadData()
    }, [user, viewAll])

    async function loadData() {
        try {
            let query = supabase
                .from('deals')
                .select('id, legacy_id, commodity_type, source_name, origin_country, price_type, price, price_currency, net_discount, quantity, quantity_unit, status, date_received, ai_score, created_by')
                .order('date_received', { ascending: false })
                .limit(50)

            if (!isAdmin || !viewAll) {
                query = query.eq('created_by', user.id)
            }

            const { data, error } = await query
            if (error) throw error
            setDeals(data || [])

            const all = data || []
            setStats({
                total: all.length,
                unassigned: all.filter(d => d.status === 'unassigned').length,
                inProgress: all.filter(d => d.status === 'in_progress').length,
                done: all.filter(d => d.status === 'done').length,
            })

            // Load profile names for owner column (admin viewAll only)
            if (isAdmin && viewAll) {
                const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email')
                const map = {}
                ;(profilesData || []).forEach(p => { map[p.id] = p.full_name || p.email || 'Unknown' })
                setProfiles(map)
            } else {
                setProfiles({})
            }
        } catch (err) {
            console.error('Error loading deals:', err)
        } finally {
            setLoading(false)
        }
    }

    function formatScore(score) {
        if (score == null) return <span className="score score-none">—</span>
        const cls = score >= 70 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low'
        return <span className={`score ${cls}`}>{score}</span>
    }

    function formatPrice(deal) {
        if (deal.price_type === 'lme_discount' && deal.net_discount != null) {
            return `LME ${deal.net_discount}%`
        }
        if (deal.price != null) {
            return `${deal.price} ${deal.price_currency || 'USD'}`
        }
        return '—'
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p className="subtitle">
                        {isAdmin && viewAll ? 'Viewing all users\' deals' : 'Overview of your commodity deals'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {isAdmin && (
                        <button
                            className={`btn ${viewAll ? 'btn-secondary' : 'btn-ghost'}`}
                            onClick={() => setViewAll(v => !v)}
                        >
                            {viewAll ? '👥 All Users' : '👤 My Data'}
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                        ➕ Add New Deal
                    </button>
                </div>
            </div>

            {isAdmin && viewAll && (
                <div style={{
                    padding: '10px 16px',
                    background: 'var(--warning-50)',
                    border: '1px solid var(--warning-300)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    color: 'var(--warning-700)',
                    marginBottom: '16px'
                }}>
                    👁 Admin view — showing all users' deals
                </div>
            )}

            <div className="stats-grid stagger">
                <div className="stat-card">
                    <div className="stat-label">Total Deals</div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Unassigned</div>
                    <div className="stat-value">{stats.unassigned}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">In Progress</div>
                    <div className="stat-value">{stats.inProgress}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Completed</div>
                    <div className="stat-value">{stats.done}</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>📋 Recent Deals</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    {deals.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🎯</div>
                            <h3>No Deals Yet</h3>
                            <p>Start by adding your first deal!</p>
                            <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                                ➕ Add Your First Deal
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Commodity</th>
                                        <th>Source</th>
                                        <th>Origin</th>
                                        <th>Price</th>
                                        <th>Quantity</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>AI Score</th>
                                        {isAdmin && viewAll && <th>Owner</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {deals.map(deal => (
                                        <tr key={deal.id} onClick={() => navigate(`/deals/${deal.id}`)}>
                                            <td><strong>#{deal.legacy_id || deal.id?.slice(0, 6) || '?'}</strong></td>
                                            <td><strong>{deal.commodity_type || 'Unknown'}</strong></td>
                                            <td>{deal.source_name || '—'}</td>
                                            <td>{deal.origin_country || '—'}</td>
                                            <td>{formatPrice(deal)}</td>
                                            <td>{deal.quantity ? `${deal.quantity} ${deal.quantity_unit || ''}` : '—'}</td>
                                            <td>
                                                <span className={`badge badge-${deal.status || 'unassigned'}`}>
                                                    {(deal.status || 'unassigned').replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td>{deal.date_received ? new Date(deal.date_received).toLocaleDateString() : '—'}</td>
                                            <td>{formatScore(deal.ai_score)}</td>
                                            {isAdmin && viewAll && (
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {profiles[deal.created_by] || '—'}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
