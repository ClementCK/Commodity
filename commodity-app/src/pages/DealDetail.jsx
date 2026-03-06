import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'

export default function DealDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { isAdmin, loading: authLoading } = useAuth()
    const toast = useToast()
    const [deal, setDeal] = useState(null)
    const [analysis, setAnalysis] = useState(null)
    const [loading, setLoading] = useState(true)
    const [scoring, setScoring] = useState(false)
    const [showDelete, setShowDelete] = useState(false)
    const [loadError, setLoadError] = useState(null)

    useEffect(() => {
        if (authLoading) return  // wait for auth session before querying
        loadDeal()
    }, [id, authLoading])

    async function loadDeal() {
        setLoading(true)
        setLoadError(null)

        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            // PGRST116 = 0 rows (deal truly not found); anything else = network/server error
            if (error.code === 'PGRST116' || error.code === '42501') {
                toast.error('Deal not found')
                navigate('/')
            } else {
                setLoadError(error.message || 'Failed to load deal')
            }
            setLoading(false)
            return
        }

        if (!data) {
            toast.error('Deal not found')
            navigate('/')
            return
        }

        setDeal(data)

        // Load latest analysis (failure is non-fatal — just skip)
        const { data: analyses } = await supabase
            .from('deal_analyses')
            .select('*')
            .eq('deal_id', id)
            .order('created_at', { ascending: false })
            .limit(1)

        if (analyses?.length > 0) setAnalysis(analyses[0])
        setLoading(false)
    }

    async function handleScore() {
        setScoring(true)
        try {
            const { data, error } = await supabase.functions.invoke('score-deal', {
                body: { deal_id: id }
            })
            if (error) throw error
            toast.success('Deal scored successfully!')
            loadDeal()
        } catch (err) {
            toast.error(err.message || 'Failed to score deal. Check API key in Settings.')
        } finally {
            setScoring(false)
        }
    }

    async function handleDelete() {
        const { error } = await supabase.from('deals').delete().eq('id', id)
        if (error) {
            toast.error('Failed to delete deal')
        } else {
            toast.success('Deal deleted')
            navigate('/')
        }
    }

    if (loading || authLoading) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    // Network/server error — show retry instead of crashing
    if (loadError) {
        return (
            <div className="empty-state">
                <div className="icon">⚠️</div>
                <h3>Could not load deal</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{loadError}</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <button className="btn btn-primary" onClick={loadDeal}>Try Again</button>
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>Dashboard</button>
                </div>
            </div>
        )
    }

    if (!deal) return null

    const formatPrice = () => {
        if (deal.price_type === 'lme_discount' && deal.net_discount != null) {
            return `LME ${deal.net_discount}% (Gross: ${deal.gross_discount}%, Comm: ${deal.commission}%)`
        }
        if (deal.price != null) {
            const base = `${deal.price} ${deal.price_currency || 'USD'}`
            if (deal.fixed_commission != null) return `${base} (Comm: ${deal.fixed_commission} → Net: ${deal.net_price ?? '—'} ${deal.price_currency || 'USD'})`
            return base
        }
        return '—'
    }

    const formatContractEnd = () => {
        if (!deal.contract_start_date || !deal.contract_duration_months) return null
        const d = new Date(deal.contract_start_date)
        d.setMonth(d.getMonth() + deal.contract_duration_months)
        return d.toLocaleDateString()
    }

    const status = deal.status || 'unassigned'

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Deal #{deal.legacy_id || deal.id.slice(0, 8)}</h1>
                    <p className="subtitle">{deal.commodity_type} — {deal.source_name}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={handleScore} disabled={scoring}>
                        {scoring ? '🔄 Scoring...' : '🤖 AI Score'}
                    </button>
                    <Link to={`/deals/${id}/edit`} className="btn btn-secondary">✏️ Edit</Link>
                    {isAdmin && (
                        <button className="btn btn-danger" onClick={() => setShowDelete(true)}>🗑 Delete</button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                {/* Deal Info */}
                <div className="card">
                    <div className="card-header"><h3>📋 Deal Information</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <InfoRow label="Commodity" value={deal.commodity_type} />
                            <InfoRow label="Source" value={deal.source_name} />
                            <InfoRow label="Price" value={formatPrice()} />
                            <InfoRow label="Quantity" value={deal.quantity ? `${deal.quantity} ${deal.quantity_unit || ''}` : '—'} />
                            <InfoRow label="Origin" value={deal.origin_country || '—'} />
                            <InfoRow label="Shipping" value={deal.shipping_terms || '—'} />
                            <InfoRow label="Payment" value={deal.payment_method || '—'} />
                            <InfoRow label="Date" value={deal.date_received ? new Date(deal.date_received).toLocaleDateString() : '—'} />
                            <InfoRow
                                label="货物类型 (Delivery Type)"
                                value={deal.delivery_type === 'futures' ? '期货 (Futures)' : '现货 (Spot)'}
                            />
                            {deal.delivery_type === 'futures' && (
                                <>
                                    <InfoRow
                                        label="Contract Period"
                                        value={deal.contract_start_date
                                            ? `${new Date(deal.contract_start_date).toLocaleDateString()} · ${deal.contract_duration_months ?? '?'} months → ${formatContractEnd() || '?'}`
                                            : '—'}
                                    />
                                    <InfoRow
                                        label="Delivery Frequency (交货频率)"
                                        value={deal.delivery_frequency
                                            ? deal.delivery_frequency.charAt(0).toUpperCase() + deal.delivery_frequency.slice(1)
                                            : '—'}
                                    />
                                </>
                            )}
                        </div>
                        {deal.delivery_type === 'futures' && deal.delivery_schedule_notes && (
                            <div style={{ marginTop: '16px' }}>
                                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>交货安排 (Delivery Schedule)</h4>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{deal.delivery_schedule_notes}</p>
                            </div>
                        )}
                        {deal.deal_text && (
                            <div style={{ marginTop: '24px' }}>
                                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raw Deal Text</h4>
                                <div style={{ background: 'var(--bg-inset)', padding: '16px', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.6, fontFamily: 'monospace', border: '1px solid var(--border-default)' }}>
                                    {deal.deal_text}
                                </div>
                            </div>
                        )}
                        {deal.additional_notes && (
                            <div style={{ marginTop: '16px' }}>
                                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Notes</h4>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{deal.additional_notes}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status & Score Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card">
                        <div className="card-header"><h3>📊 Status</h3></div>
                        <div className="card-body" style={{ textAlign: 'center' }}>
                            <span className={`badge badge-${status}`} style={{ fontSize: '14px', padding: '8px 20px' }}>
                                {status.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3>🤖 AI Score</h3></div>
                        <div className="card-body" style={{ textAlign: 'center' }}>
                            {deal.ai_score != null ? (
                                <>
                                    <div style={{ fontSize: '64px', fontWeight: 800, color: deal.ai_score >= 70 ? 'var(--success-600)' : deal.ai_score >= 50 ? 'var(--warning-600)' : 'var(--danger-600)' }}>
                                        {deal.ai_score}
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>/ 100</div>
                                    {analysis && (
                                        <Link to={`/deals/${id}/analysis`} className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
                                            View Full Analysis →
                                        </Link>
                                    )}
                                </>
                            ) : (
                                <div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>Not scored yet</p>
                                    <button className="btn btn-primary btn-sm" onClick={handleScore} disabled={scoring}>
                                        {scoring ? 'Scoring...' : '🤖 Score Now'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete confirmation modal */}
            {showDelete && (
                <div className="modal-overlay" onClick={() => setShowDelete(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '12px' }}>🗑 Delete Deal?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>This action cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
                            <button className="btn btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function InfoRow({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    )
}
