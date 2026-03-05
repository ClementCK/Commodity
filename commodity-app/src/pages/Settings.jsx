import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function Settings() {
    const [sources, setSources] = useState([])
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('ai')
    const [newSource, setNewSource] = useState({ name: '', reliability_rating: 5, notes: '' })
    const [editingSource, setEditingSource] = useState(null)
    const toast = useToast()

    // AI Settings state (non-secret only — API key stays in Supabase)
    const [aiModel, setAiModel] = useState('claude-sonnet-4-5-20250929')
    const [aiTemperature, setAiTemperature] = useState(0.7)
    const [aiMaxTokens, setAiMaxTokens] = useState(16000)
    const [systemPrompt, setSystemPrompt] = useState(
        `You are an expert AI assistant for a Commodity Deal Tracking system. Your role is to help analyze deals, provide market insights, and answer questions about commodity transactions.\n\nYou have access to the complete database of deals in the system. Use this data to:\n- Answer specific questions about deals\n- Analyze trends and patterns\n- Compare different deals and sources\n- Provide risk assessments\n- Suggest opportunities\n- Generate reports and summaries\n\nAlways be accurate, data-driven, and cite specific deal IDs when referencing deals. Be helpful and provide actionable insights.`
    )

    useEffect(() => {
        loadSettings()
        loadSources()
    }, [])

    async function loadSettings() {
        // Load from Supabase (only non-secret settings are returned by RLS)
        const { data } = await supabase.from('app_settings').select('key, value')
        if (data?.length) {
            const map = Object.fromEntries(data.map(s => [s.key, s.value]))
            if (map.ai_model) setAiModel(map.ai_model)
            if (map.ai_temperature) setAiTemperature(parseFloat(map.ai_temperature))
            if (map.ai_max_tokens) setAiMaxTokens(parseInt(map.ai_max_tokens))
            if (map.system_prompt) setSystemPrompt(map.system_prompt)
        }
        // Fallback: also sync to localStorage for Assistant.jsx to use
        const local = localStorage.getItem('app_settings')
        if (local) {
            const parsed = JSON.parse(local)
            if (!data?.length) {
                if (parsed.ai_model) setAiModel(parsed.ai_model)
                if (parsed.ai_temperature) setAiTemperature(parseFloat(parsed.ai_temperature))
                if (parsed.ai_max_tokens) setAiMaxTokens(parseInt(parsed.ai_max_tokens))
                if (parsed.system_prompt) setSystemPrompt(parsed.system_prompt)
            }
        }
    }

    async function loadSources() {
        const { data } = await supabase.from('sources').select('*').order('name')
        setSources(data || [])
    }

    async function handleSave() {
        setSaving(true)
        try {
            // Save non-secret settings to Supabase
            const updates = [
                { key: 'ai_model', value: aiModel },
                { key: 'ai_temperature', value: aiTemperature.toString() },
                { key: 'ai_max_tokens', value: aiMaxTokens.toString() },
                { key: 'system_prompt', value: systemPrompt },
            ]
            for (const update of updates) {
                await supabase.from('app_settings')
                    .upsert({ key: update.key, value: update.value, is_secret: false }, { onConflict: 'key' })
            }

            // Also cache in localStorage for Assistant.jsx
            const existing = JSON.parse(localStorage.getItem('app_settings') || '{}')
            localStorage.setItem('app_settings', JSON.stringify({
                ...existing,
                ai_model: aiModel,
                ai_temperature: aiTemperature.toString(),
                ai_max_tokens: aiMaxTokens.toString(),
                system_prompt: systemPrompt,
            }))

            toast.success('Settings saved!')
        } catch (err) {
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
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
                    <h1>⚙️ Settings</h1>
                    <p className="subtitle">Configure AI assistant and sources</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
                <button className={`btn ${activeTab === 'ai' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('ai')}>
                    🤖 AI Configuration
                </button>
                <button className={`btn ${activeTab === 'sources' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('sources')}>
                    🏢 Sources
                </button>
            </div>

            {/* AI Configuration Tab */}
            {activeTab === 'ai' && (
                <div className="card">
                    <div className="card-header">
                        <h3>🤖 AI Configuration (Claude)</h3>
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : '💾 Save Changes'}
                        </button>
                    </div>
                    <div className="card-body">

                        {/* API Key notice */}
                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Anthropic API Key</label>
                                <p>Stored securely in Supabase — never exposed to the browser</p>
                            </div>
                            <div className="setting-control">
                                <div style={{
                                    padding: '10px 14px',
                                    background: 'var(--success-50)',
                                    border: '1px solid var(--success-600)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--success-700)',
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    🔒 sk-ant-••••••••••••••••••••••••• (secured)
                                </div>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Model</label>
                                <p>Claude model to use for AI scoring and analysis</p>
                            </div>
                            <div className="setting-control">
                                <select className="form-control" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                                    <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended)</option>
                                    <option value="claude-opus-4-6">Claude Opus 4.6 (Most Capable)</option>
                                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Temperature</label>
                                <p>Controls randomness (0.0 = precise, 1.0 = creative)</p>
                            </div>
                            <div className="setting-control">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={aiTemperature}
                                        onChange={e => setAiTemperature(parseFloat(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span style={{ fontWeight: 600, minWidth: '32px' }}>{aiTemperature.toFixed(1)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <label>Max Output Tokens</label>
                                <p>Maximum length of AI response (higher = more detailed)</p>
                            </div>
                            <div className="setting-control">
                                <input
                                    className="form-control"
                                    type="number"
                                    value={aiMaxTokens}
                                    onChange={e => setAiMaxTokens(parseInt(e.target.value) || 16000)}
                                    min="1000"
                                    max="16000"
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <div className="setting-info">
                                <label>System Prompt</label>
                                <p>Instructions for the AI assistant's behavior and role</p>
                            </div>
                            <div className="setting-control">
                                <textarea
                                    className="form-control"
                                    value={systemPrompt}
                                    onChange={e => setSystemPrompt(e.target.value)}
                                    rows={8}
                                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
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
                        <div className="empty-state"><p>No sources yet. Add one above.</p></div>
                    )}
                    {sources.map(source => {
                        const isEditing = editingSource?.id === source.id
                        const ratingColor = source.reliability_rating >= 7 ? 'var(--success-600)' : source.reliability_rating >= 4 ? 'var(--warning-600)' : 'var(--danger-600)'
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
                                                    notes: editingSource.notes
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
            )}
        </>
    )
}
