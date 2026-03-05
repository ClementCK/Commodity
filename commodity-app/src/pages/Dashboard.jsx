import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
    const [deals, setDeals] = useState([])
    const [stats, setStats] = useState({ total: 0, unassigned: 0, inProgress: 0, done: 0 })
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data, error } = await supabase
                .from('deals')
                .select('id, legacy_id, commodity_type, source_name, origin_country, price_type, price, price_currency, net_discount, quantity, quantity_unit, status, date_received, ai_score')
                .order('date_received', { ascending: false })
                .limit(50)

            if (error) throw error
            setDeals(data || [])

            // Calculate stats
            const all = data || []
            setStats({
                total: all.length,
                unassigned: all.filter(d => d.status === 'unassigned').length,
                inProgress: all.filter(d => d.status === 'in_progress').length,
                done: all.filter(d => d.status === 'done').length,
            })
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
                    <p className="subtitle">Overview of your commodity deals</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/deals/new')}>
                    ➕ Add New Deal
                </button>
            </div>

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
