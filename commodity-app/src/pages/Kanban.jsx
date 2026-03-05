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
    const [draggedId, setDraggedId] = useState(null)
    const [dragOverCol, setDragOverCol] = useState(null)
    const [viewAll, setViewAll] = useState(false)
    const navigate = useNavigate()
    const toast = useToast()
    const { user, isAdmin } = useAuth()

    useEffect(() => { if (user) loadDeals() }, [user, viewAll])

    async function loadDeals() {
        let query = supabase
            .from('deals')
            .select('id, legacy_id, commodity_type, source_name, origin_country, status, ai_score, price_type, price, price_currency, net_discount, quantity, quantity_unit')
            .order('date_received', { ascending: false })
            .limit(200)

        if (!isAdmin || !viewAll) {
            query = query.eq('created_by', user.id)
        }

        const { data, error } = await query
        if (error) {
            toast.error('Failed to load deals')
        } else {
            setDeals(data || [])
        }
        setLoading(false)
    }

    async function handleDrop(newStatus) {
        if (!draggedId) return
        setDragOverCol(null)

        const deal = deals.find(d => d.id === draggedId)
        if (!deal || deal.status === newStatus) { setDraggedId(null); return }

        // Optimistic update
        setDeals(prev => prev.map(d => d.id === draggedId ? { ...d, status: newStatus } : d))

        const { error } = await supabase
            .from('deals')
            .update({ status: newStatus })
            .eq('id', draggedId)

        if (error) {
            toast.error('Failed to update status')
            loadDeals() // Revert
        } else {
            toast.success(`Deal moved to ${newStatus.replace(/_/g, ' ')}`)
        }
        setDraggedId(null)
    }

    function formatPrice(deal) {
        if (deal.price_type === 'lme_discount' && deal.net_discount != null) return `LME ${deal.net_discount}%`
        if (deal.price != null) return `${deal.price} ${deal.price_currency || 'USD'}`
        return '—'
    }

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Deal Pipeline</h1>
                    <p className="subtitle">
                        {isAdmin && viewAll ? 'Viewing all users\' deals' : 'Drag and drop to update deal status'}
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
                                                    #{deal.legacy_id || deal.id.slice(0, 6)}
                                                </span>
                                                {deal.ai_score != null ? (
                                                    <span className={`badge ${deal.ai_score >= 70 ? 'badge-done' : deal.ai_score >= 50 ? 'badge-unassigned' : 'badge-closed_lost'}`}>
                                                        {deal.ai_score}
                                                    </span>
                                                ) : (
                                                    <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </div>
                                            <div className="kanban-card-commodity">📦 {deal.commodity_type}</div>
                                            <div className="kanban-card-source">👤 {deal.source_name}</div>
                                            <div className="kanban-card-price">💰 {formatPrice(deal)}</div>
                                            <div className="kanban-card-origin">📍 {deal.origin_country || 'Unknown'}</div>
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
