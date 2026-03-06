import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function DealAnalysis() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { loading: authLoading } = useAuth()
    const [deal, setDeal] = useState(null)
    const [analysis, setAnalysis] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)

    useEffect(() => {
        if (authLoading) return
        loadData()
    }, [id, authLoading])

    async function loadData() {
        setLoading(true)
        setLoadError(null)

        try {
            const [dealRes, analysisRes] = await Promise.all([
                supabase.from('deals').select('*').eq('id', id).single(),
                supabase.from('deal_analyses').select('*').eq('deal_id', id).order('created_at', { ascending: false }).limit(1),
            ])

            if (dealRes.error) {
                if (dealRes.error.code === 'PGRST116' || dealRes.error.code === '42501') {
                    navigate('/')
                    return
                }
                throw dealRes.error
            }

            setDeal(dealRes.data)
            setAnalysis(analysisRes.data?.[0] || null)
        } catch (err) {
            setLoadError(err.message || 'Failed to load analysis')
        } finally {
            setLoading(false)
        }
    }

    if (loading || authLoading) return <div className="loading-spinner"><div className="spinner" /></div>

    if (loadError) {
        return (
            <div className="empty-state">
                <div className="icon">⚠️</div>
                <h3>Could not load analysis</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{loadError}</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <button className="btn btn-primary" onClick={loadData}>Try Again</button>
                    <Link to={`/deals/${id}`} className="btn btn-secondary">← Back to Deal</Link>
                </div>
            </div>
        )
    }

    if (!deal) return <div className="empty-state"><h3>Deal not found</h3></div>
    if (!analysis) return (
        <div className="empty-state">
            <div className="icon">🤖</div>
            <h3>No Analysis Available</h3>
            <p>Score this deal first to see the AI analysis.</p>
            <Link to={`/deals/${id}`} className="btn btn-primary">← Back to Deal</Link>
        </div>
    )

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>🤖 AI Analysis</h1>
                    <p className="subtitle">{deal.commodity_type} — {deal.source_name}</p>
                </div>
                <Link to={`/deals/${id}`} className="btn btn-secondary">← Back to Deal</Link>
            </div>

            {/* Score Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Overall Score</div>
                    <div className="stat-value" style={{ color: analysis.score >= 70 ? 'var(--success-600)' : analysis.score >= 50 ? 'var(--warning-600)' : 'var(--danger-600)' }}>
                        {analysis.score ?? '—'}
                    </div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Risk Level</div>
                    <div className="stat-value" style={{
                        fontSize: '24px',
                        color: analysis.risk_level === 'low' ? 'var(--success-600)' : analysis.risk_level === 'medium' ? 'var(--warning-600)' : 'var(--danger-600)'
                    }}>
                        {analysis.risk_level?.toUpperCase() || '—'}
                    </div>
                </div>
                <div className="stat-card" style={{ textAlign: 'center' }}>
                    <div className="stat-label">Recommendation</div>
                    <div className="stat-value" style={{ fontSize: '16px', lineHeight: 1.4, marginTop: '8px' }}>
                        {analysis.recommendation || '—'}
                    </div>
                </div>
            </div>

            {/* Analysis Sections */}
            <div style={{ display: 'grid', gap: '24px' }}>
                <AnalysisSection title="📊 Executive Summary" content={analysis.executive_summary} />
                <AnalysisSection title="📈 Market Analysis" content={analysis.market_analysis} />
                <AnalysisSection title="🌍 Origin Analysis" content={analysis.origin_analysis} />
                <AnalysisSection title="💰 Price Analysis" content={analysis.price_analysis} />
                <AnalysisSection title="👤 Buyer Profile" content={analysis.buyer_profile} />
                <AnalysisSection title="🏦 Payment & Logistics" content={analysis.payment_logistics} />

                <ListSection title="🚩 Red Flags" items={analysis.red_flags} variant="danger" />
                <ListSection title="⚠️ Unusual Patterns" items={analysis.unusual_patterns} variant="warning" />
                <ListSection title="✅ Strengths" items={analysis.strengths} variant="success" />
                <ListSection title="📋 Next Steps" items={analysis.next_steps} variant="info" />
            </div>

            <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>
                Analyzed on {new Date(analysis.created_at).toLocaleString()}
            </div>
        </>
    )
}

function AnalysisSection({ title, content }) {
    if (!content) return null
    return (
        <div className="card">
            <div className="card-header"><h3>{title}</h3></div>
            <div className="card-body"><p style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>{content}</p></div>
        </div>
    )
}

function ListSection({ title, items, variant }) {
    if (!items?.length) return null
    const colors = {
        danger: { bg: 'var(--danger-50)', border: 'var(--danger-500)', text: 'var(--danger-700)' },
        warning: { bg: 'var(--warning-50)', border: 'var(--warning-600)', text: 'var(--text-secondary)' },
        success: { bg: 'var(--success-50)', border: 'var(--success-600)', text: 'var(--text-secondary)' },
        info: { bg: 'var(--info-50)', border: 'var(--info-600)', text: 'var(--text-secondary)' },
    }
    const c = colors[variant]
    return (
        <div className="card">
            <div className="card-header"><h3>{title}</h3></div>
            <div className="card-body">
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item, i) => (
                        <li key={i} style={{ padding: '12px 16px', background: c.bg, borderLeft: `4px solid ${c.border}`, borderRadius: 'var(--radius-sm)', color: c.text, fontSize: '14px', lineHeight: 1.5 }}>
                            {typeof item === 'string' ? item : item.text || item.description || JSON.stringify(item)}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
