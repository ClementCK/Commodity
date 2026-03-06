import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'

const COLUMNS = [
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'on_hold', label: 'On Hold' },
    { key: 'done', label: 'Done' },
]

export default function Kanban() {
    const [deals, setDeals] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)
    const [draggedId, setDraggedId] = useState(null)
    const [dragOverCol, setDragOverCol] = useState(null)
    const [viewAll, setViewAll] = useState(false)
    const [profiles, setProfiles] = useState({})
    const navigate = useNavigate()
    const toast = useToast()
    const { user, isAdmin } = useAuth()

    // user?.id: stable string, won't retrigger on token refresh
    // isAdmin: derived from profile (loads async after user) — must be included
    // so an admin gets the correct query filter once profile resolves
    useEffect(() => {
        if (!user?.id) return
        setLoading(true)
        setLoadError(null)
        loadDeals()
    }, [user?.id, viewAll, isAdmin])

    async function loadDeals() {
        try {
            let query = supabase
                .from('deals')
                .select('id, legacy_id, commodity_type, source_name, origin_country, status, ai_score, price_type, price, price_currency, net_discount, quantity, quantity_unit, created_by')
                .order('date_received', { ascending: false })
                .limit(200)

            if (!isAdmin || !viewAll) {
                query = query.eq('created_by', user.id)
            }

            const { data, error } = await query
            if (error) throw error

            setDeals(data || [])

            if (isAdmin && viewAll) {
                const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email')
                const map = {}
                ;(profilesData || []).forEach(p => { map[p.id] = p.full_name || p.email || 'Unknown' })
                setProfiles(map)
            } else {
                setProfiles({})
            }
        } catch (err) {
            console.error('Kanban load error:', err)
            setLoadError(err.message || 'Failed to load deals')
        } finally {
            setLoading(false)
        }
    }

    async function handleDrop(newStatus) {
        if (!draggedId) return
        setDragOverCol(null)

        const deal = deals.find(d => d.id === draggedId)
        if (!deal || deal.status === newStatus) { setDraggedId(null); return }

        // Optimistic update — apply immediately
        setDeals(prev => prev.map(d => d.id === draggedId ? { ...d, status: newStatus } : d))
        setDraggedId(null)

        const { error } = await supabase
            .from('deals')
            .update({ status: newStatus })
            .eq('id', draggedId)

        if (error) {
            toast.error('Failed to update status')
            // Revert the optimistic update
            setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, status: deal.status } : d))
        } else {
            toast.success(`Moved to ${newStatus.replace(/_/g, ' ')}`)
        }
    }

    function formatPrice(deal) {
        if (deal.price_type === 'lme_discount' && deal.net_discount != null) return `LME ${deal.net_discount}%`
        if (deal.price != null) return `${deal.price} ${deal.price_currency || 'USD'}`
        return '—'
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    if (loadError) {
        return (
            <div className="empty-state">
                <div className="icon">⚠️</div>
                <h3>Could not load pipeline</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{loadError}</p>
                <button className="btn btn-primary" onClick={() => { setLoading(true); setLoadError(null); loadDeals() }}>
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Deal Pipeline</h1>
                    <p className="subtitle">
                        {isAdmin && viewAll ? "Viewing all users' deals" : 'Drag and drop to update deal status'}
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
                        ➕ Add Deal
                    </button>
                </div>
            </div>

            <div className="kanban-board">
                {COLUMNS.map(col => {
                    const colDeals = deals.filter(d => d.status === col.key)
                    return (
                        <div key={col.key} className={`kanban-column col-${col.key}`}>
                            <div className="kanban-column-header">
                                {col.label}
                                <span className="count">{colDeals.length}</span>
                            </div>
                            <div
                                className={`kanban-cards${dragOverCol === col.key ? ' drag-over' : ''}`}
                                onDragOver={e => { e.preventDefault(); setDragOverCol(col.key) }}
                                onDragLeave={() => setDragOverCol(null)}
                                onDrop={e => { e.preventDefault(); handleDrop(col.key) }}
                            >
                                {colDeals.length === 0 ? (
                                    <div className="empty-state" style={{ padding: '20px' }}>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Drop deals here</p>
                                    </div>
                                ) : (
                                    colDeals.map(deal => (
                                        <div
                                            key={deal.id}
                                            className={`kanban-card${draggedId === deal.id ? ' dragging' : ''}`}
                                            draggable
                                            onDragStart={() => setDraggedId(deal.id)}
                                            onDragEnd={() => { setDraggedId(null); setDragOverCol(null) }}
                                            onDoubleClick={() => navigate(`/deals/${deal.id}`)}
                                        >
                                            <div className="kanban-card-meta">
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    #{deal.legacy_id || deal.id?.slice(0, 6) || '?'}
                                                </span>
                                                {deal.ai_score != null ? (
                                                    <span className={`badge ${deal.ai_score >= 70 ? 'badge-done' : deal.ai_score >= 50 ? 'badge-unassigned' : 'badge-closed_lost'}`}>
                                                        {deal.ai_score}
                                                    </span>
                                                ) : (
                                                    <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </div>
                                            <div className="kanban-card-commodity">📦 {deal.commodity_type || 'Unknown'}</div>
                                            <div className="kanban-card-source">👤 {deal.source_name || '—'}</div>
                                            <div className="kanban-card-price">💰 {formatPrice(deal)}</div>
                                            <div className="kanban-card-origin">📍 {deal.origin_country || 'Unknown'}</div>
                                            {isAdmin && viewAll && deal.created_by && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-default)' }}>
                                                    🙍 {profiles[deal.created_by] || '—'}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
