import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function Sources() {
    const [sources, setSources] = useState([])
    const [newSource, setNewSource] = useState({ name: '', reliability_rating: 5, notes: '' })
    const [editingSource, setEditingSource] = useState(null)
    const toast = useToast()

    useEffect(() => { loadSources() }, [])

    async function loadSources() {
        const { data } = await supabase.from('sources').select('*').order('name')
        setSources(data || [])
    }

    async function addSource() {
        if (!newSource.name.trim()) return
        const { error } = await supabase.from('sources').insert({
            name: newSource.name.trim(),
            reliability_rating: parseFloat(newSource.reliability_rating) || 5,
            notes: newSource.notes.trim() || null,
        })
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source added!')
            setNewSource({ name: '', reliability_rating: 5, notes: '' })
            loadSources()
        }
    }

    async function updateSource(sourceId, updates) {
        const { error } = await supabase.from('sources').update(updates).eq('id', sourceId)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source updated!')
            setEditingSource(null)
            loadSources()
        }
    }

    async function deleteSource(sourceId) {
        if (!window.confirm('Delete this source?')) return
        const { error } = await supabase.from('sources').delete().eq('id', sourceId)
        if (error) {
            toast.error(error.message)
        } else {
            toast.success('Source deleted')
            loadSources()
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>🏢 Sources</h1>
                    <p className="subtitle">Manage commodity sources and their reliability ratings</p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Add New Source */}
                <div className="card">
                    <div className="card-header"><h3>+ Add New Source</h3></div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input
                                    className="form-control"
                                    placeholder="Source name (e.g. Trafigura, Glencore...)"
                                    value={newSource.name}
                                    onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && addSource()}
                                />
                                <textarea
                                    className="form-control"
                                    placeholder="Notes (optional)..."
                                    value={newSource.notes}
                                    onChange={e => setNewSource(prev => ({ ...prev, notes: e.target.value }))}
                                    rows={2}
                                    style={{ resize: 'vertical', fontSize: '13px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rating (0–10)</label>
                                <input
                                    className="form-control"
                                    type="number" min="0" max="10" step="0.1"
                                    value={newSource.reliability_rating}
                                    onChange={e => setNewSource(prev => ({ ...prev, reliability_rating: e.target.value }))}
                                    style={{ width: '90px' }}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={addSource} style={{ alignSelf: 'flex-start', marginTop: '20px' }}>
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Source Cards */}
                {sources.length === 0 && (
                    <div className="empty-state">
                        <div className="icon">🏢</div>
                        <h3>No sources yet</h3>
                        <p>Add your first source above.</p>
                    </div>
                )}

                {sources.map(source => {
                    const isEditing = editingSource?.id === source.id
                    const ratingColor = source.reliability_rating >= 7
                        ? 'var(--success-600)'
                        : source.reliability_rating >= 4
                            ? 'var(--warning-600)'
                            : 'var(--danger-600)'

                    return (
                        <div key={source.id} className="card">
                            <div className="card-body">
                                {isEditing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
                                            <input
                                                className="form-control"
                                                value={editingSource.name}
                                                onChange={e => setEditingSource(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="Source name"
                                                style={{ fontWeight: 600, fontSize: '15px' }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rating (0–10)</label>
                                                <input
                                                    className="form-control"
                                                    type="number" min="0" max="10" step="0.1"
                                                    value={editingSource.reliability_rating}
                                                    onChange={e => setEditingSource(prev => ({ ...prev, reliability_rating: e.target.value }))}
                                                    style={{ width: '90px' }}
                                                />
                                            </div>
                                        </div>
                                        <textarea
                                            className="form-control"
                                            value={editingSource.notes || ''}
                                            onChange={e => setEditingSource(prev => ({ ...prev, notes: e.target.value }))}
                                            placeholder="Notes about this source..."
                                            rows={3}
                                            style={{ resize: 'vertical', fontSize: '13px' }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => updateSource(source.id, {
                                                name: editingSource.name,
                                                reliability_rating: parseFloat(editingSource.reliability_rating),
                                                notes: editingSource.notes || null,
                                            })}>💾 Save</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingSource(null)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                                                <strong style={{ fontSize: '16px' }}>{source.name}</strong>
                                                <span style={{ fontWeight: 700, fontSize: '18px', color: ratingColor }}>
                                                    {source.reliability_rating}/10
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {source.total_deals || 0} deals · {source.successful_deals || 0} successful
                                                </span>
                                            </div>
                                            {source.notes && (
                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                                    📝 {source.notes}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setEditingSource({ ...source })}>✏️ Edit</button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger-500)' }} onClick={() => deleteSource(source.id)}>🗑</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )
}
