import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import DealDocuments from '../components/DealDocuments'

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 10 * 1024 * 1024

export default function DealForm() {
    const { id } = useParams()
    const isEdit = !!id
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const toast = useToast()

    const [sources, setSources] = useState([])
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(isEdit)
    const [pendingFiles, setPendingFiles] = useState([])

    const [form, setForm] = useState({
        commodity_type: '',
        source_name: '',
        deal_text: '',
        price_type: 'lme_discount',
        price: '',
        price_currency: 'USD',
        gross_discount: '',
        commission: '',
        net_discount: '',
        fixed_commission: '',
        net_price: '',
        quantity: '',
        quantity_unit: 'kg',
        origin_country: '',
        shipping_terms: '',
        payment_method: '',
        delivery_type: 'spot',
        contract_start_date: '',
        contract_duration_months: '',
        delivery_frequency: 'monthly',
        delivery_schedule_notes: '',
        date_received: new Date().toISOString().split('T')[0],
        status: 'unassigned',
        additional_notes: '',
    })

    useEffect(() => { if (user?.id) loadSources() }, [user?.id])
    useEffect(() => {
        if (authLoading) return  // wait for auth before loading deal for edit
        if (isEdit) loadDeal()
    }, [id, authLoading])

    async function loadSources() {
        const { data } = await supabase
            .from('sources')
            .select('id, name, reliability_rating')
            .eq('user_id', user.id)
            .order('name')
        setSources(data || [])
    }

    async function loadDeal() {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            if (error.code === 'PGRST116' || error.code === '42501') {
                toast.error('Deal not found')
                navigate('/')
            } else {
                toast.error('Failed to load deal. Please try again.')
            }
            setFetching(false)
            return
        }

        if (!data) {
            toast.error('Deal not found')
            navigate('/')
            return
        }

        setForm({
            commodity_type: data.commodity_type || '',
            source_name: data.source_name || '',
            deal_text: data.deal_text || '',
            price_type: data.price_type || 'fixed_price',
            price: data.price ?? '',
            price_currency: data.price_currency || 'USD',
            gross_discount: data.gross_discount ?? '',
            commission: data.commission ?? '',
            net_discount: data.net_discount ?? '',
            fixed_commission: data.fixed_commission ?? '',
            net_price: data.net_price ?? '',
            quantity: data.quantity ?? '',
            quantity_unit: data.quantity_unit || 'kg',
            origin_country: data.origin_country || '',
            shipping_terms: data.shipping_terms || '',
            payment_method: data.payment_method || '',
            delivery_type: data.delivery_type || 'spot',
            contract_start_date: data.contract_start_date || '',
            contract_duration_months: data.contract_duration_months ?? '',
            delivery_frequency: data.delivery_frequency || 'monthly',
            delivery_schedule_notes: data.delivery_schedule_notes || '',
            date_received: data.date_received || '',
            status: data.status || 'unassigned',
            additional_notes: data.additional_notes || '',
        })
        setFetching(false)
    }

    function calcContractEndDate(startDate, durationMonths) {
        if (!startDate || !durationMonths) return null
        const d = new Date(startDate)
        d.setMonth(d.getMonth() + parseInt(durationMonths))
        return d.toLocaleDateString()
    }

    function handleFileQueue(file) {
        if (!file) return
        if (!ALLOWED_MIME.has(file.type)) {
            toast.error('Only PDF and Word documents (.pdf, .doc, .docx) are allowed')
            return
        }
        if (file.size > MAX_BYTES) {
            toast.error('File must be smaller than 10 MB')
            return
        }
        if (pendingFiles.some(f => f.name === file.name && f.size === file.size)) {
            toast.error('This file is already in the queue')
            return
        }
        setPendingFiles(prev => [...prev, file])
    }

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => {
            const next = { ...prev, [name]: value }
            // Auto-calc net discount for LME
            if (name === 'gross_discount' || name === 'commission') {
                const gross = parseFloat(name === 'gross_discount' ? value : prev.gross_discount) || 0
                const comm = parseFloat(name === 'commission' ? value : prev.commission) || 0
                next.net_discount = (gross - comm).toFixed(1)
            }
            // Auto-calc net price for fixed price (flat deduction)
            if (name === 'price' || name === 'fixed_commission') {
                const price = parseFloat(name === 'price' ? value : prev.price) || 0
                const comm = parseFloat(name === 'fixed_commission' ? value : prev.fixed_commission) || 0
                next.net_price = (price - comm).toFixed(2)
            }
            return next
        })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)

        const source = sources.find(s => s.name === form.source_name)

        const payload = {
            commodity_type: form.commodity_type,
            source_name: form.source_name,
            source_id: source?.id || null,
            source_reliability: source?.reliability_rating || null,
            deal_text: form.deal_text || null,
            price_type: form.price_type,
            price: form.price_type === 'fixed_price' ? (parseFloat(form.price) || null) : null,
            price_currency: form.price_currency,
            gross_discount: form.price_type === 'lme_discount' ? (parseFloat(form.gross_discount) || null) : null,
            commission: form.price_type === 'lme_discount' ? (parseFloat(form.commission) || null) : null,
            net_discount: form.price_type === 'lme_discount' ? (parseFloat(form.net_discount) || null) : null,
            fixed_commission: form.price_type === 'fixed_price' ? (parseFloat(form.fixed_commission) || null) : null,
            net_price: form.price_type === 'fixed_price' ? (parseFloat(form.net_price) || null) : null,
            quantity: parseFloat(form.quantity) || null,
            quantity_unit: form.quantity_unit,
            origin_country: form.origin_country || null,
            shipping_terms: form.shipping_terms || null,
            payment_method: form.payment_method || null,
            delivery_type: form.delivery_type || 'spot',
            contract_start_date: form.delivery_type === 'futures' ? (form.contract_start_date || null) : null,
            contract_duration_months: form.delivery_type === 'futures' ? (parseInt(form.contract_duration_months) || null) : null,
            delivery_frequency: form.delivery_type === 'futures' ? (form.delivery_frequency || null) : null,
            delivery_schedule_notes: form.delivery_type === 'futures' ? (form.delivery_schedule_notes || null) : null,
            date_received: form.date_received,
            status: form.status,
            additional_notes: form.additional_notes || null,
        }

        try {
            if (isEdit) {
                const { error } = await supabase.from('deals').update(payload).eq('id', id)
                if (error) throw error
                toast.success('Deal updated successfully!')
                navigate(`/deals/${id}`)
            } else {
                if (!user?.id) throw new Error('Not authenticated. Please log in again.')
                payload.created_by = user.id
                const { data, error } = await supabase.from('deals').insert(payload).select('id').single()
                if (error) throw error
                if (!data?.id) throw new Error('Failed to create deal')
                toast.success('Deal created successfully!')
                // Upload any queued documents (failures are non-fatal)
                for (const file of pendingFiles) {
                    const storagePath = `${data.id}/${crypto.randomUUID()}-${file.name}`
                    const { error: storErr } = await supabase.storage
                        .from('deal-documents')
                        .upload(storagePath, file, { upsert: false })
                    if (storErr) {
                        toast.error(`Could not upload "${file.name}"`)
                        continue
                    }
                    await supabase.from('deal_documents').insert({
                        deal_id: data.id,
                        uploaded_by: user.id,
                        file_name: file.name,
                        storage_path: storagePath,
                        file_size: file.size,
                        mime_type: file.type,
                    })
                }
                navigate(`/deals/${data.id}`)
            }
        } catch (err) {
            toast.error(err.message || 'Failed to save deal')
        } finally {
            setLoading(false)
        }
    }

    if (authLoading || fetching) {
        return <div className="loading-spinner"><div className="spinner" /></div>
    }

    const contractEndDate = calcContractEndDate(form.contract_start_date, form.contract_duration_months)

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>{isEdit ? 'Edit Deal' : '➕ Add New Deal'}</h1>
                    <p className="subtitle">{isEdit ? 'Update deal information' : 'Enter deal information manually'}</p>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        {/* Basic Info */}
                        <div className="form-section">
                            <div className="form-section-title">📦 Basic Information</div>

                            <div className="form-group">
                                <label>Commodity Type <span className="required">*</span></label>
                                <input
                                    className="form-control"
                                    name="commodity_type"
                                    value={form.commodity_type}
                                    onChange={handleChange}
                                    placeholder="e.g., Gold, Copper Cathodes, Aluminum Ingots"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Source/Contact <span className="required">*</span></label>
                                <input
                                    className="form-control"
                                    list="sources-datalist"
                                    name="source_name"
                                    value={form.source_name}
                                    onChange={handleChange}
                                    placeholder={sources.length ? 'Select or type source name...' : 'Type source name...'}
                                    required
                                    autoComplete="off"
                                />
                                <datalist id="sources-datalist">
                                    {sources.map(s => (
                                        <option key={s.id} value={s.name}>
                                            {s.reliability_rating}/10
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            <div className="form-group">
                                <label>Deal Details</label>
                                <textarea
                                    className="form-control"
                                    name="deal_text"
                                    value={form.deal_text}
                                    onChange={handleChange}
                                    placeholder="Paste raw deal message from WhatsApp/WeChat here..."
                                />
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="form-section">
                            <div className="form-section-title">💰 Pricing</div>

                            <div className="form-group">
                                <label>Price Type</label>
                                <select className="form-control" name="price_type" value={form.price_type} onChange={handleChange}>
                                    <option value="lme_discount">LME Discount (for metals)</option>
                                    <option value="fixed_price">Fixed Price</option>
                                </select>
                            </div>

                            {form.price_type === 'lme_discount' ? (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Gross Discount (%)</label>
                                            <input className="form-control" type="number" step="0.1" name="gross_discount" value={form.gross_discount} onChange={handleChange} placeholder="-12.0" />
                                        </div>
                                        <div className="form-group">
                                            <label>Commission (%)</label>
                                            <input className="form-control" type="number" step="0.1" name="commission" value={form.commission} onChange={handleChange} placeholder="3.0" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Net Discount (%)</label>
                                        <input className="form-control" type="number" step="0.1" name="net_discount" value={form.net_discount} readOnly style={{ background: 'var(--bg-inset)' }} />
                                        <div className="form-help">Auto-calculated: Gross − Commission</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Price</label>
                                            <input className="form-control" type="number" step="0.01" name="price" value={form.price} onChange={handleChange} placeholder="1970.00" />
                                        </div>
                                        <div className="form-group">
                                            <label>Currency</label>
                                            <select className="form-control" name="price_currency" value={form.price_currency} onChange={handleChange}>
                                                <option value="USD">USD</option>
                                                <option value="CNY">CNY</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Commission (flat amount)</label>
                                            <input className="form-control" type="number" step="0.01" name="fixed_commission" value={form.fixed_commission} onChange={handleChange} placeholder="30.00" />
                                            <div className="form-help">In {form.price_currency} — deducted from price</div>
                                        </div>
                                        <div className="form-group">
                                            <label>Net Price (after commission)</label>
                                            <input className="form-control" type="number" step="0.01" name="net_price" value={form.net_price} readOnly style={{ background: 'var(--bg-inset)' }} />
                                            <div className="form-help">Auto-calculated: Price − Commission</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Quantity & Logistics */}
                        <div className="form-section">
                            <div className="form-section-title">🌍 Logistics</div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Quantity</label>
                                    <input className="form-control" type="number" step="0.01" name="quantity" value={form.quantity} onChange={handleChange} placeholder="500" />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <select className="form-control" name="quantity_unit" value={form.quantity_unit} onChange={handleChange}>
                                        <option value="kg">kg (kilograms)</option>
                                        <option value="MT">MT (metric tons)</option>
                                        <option value="tons">tons</option>
                                        <option value="oz">oz (ounces)</option>
                                        <option value="lbs">lbs (pounds)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Spot / Futures */}
                            <div className="form-group">
                                <label>货物类型 (Delivery Type)</label>
                                <select className="form-control" name="delivery_type" value={form.delivery_type} onChange={handleChange}>
                                    <option value="spot">现货 (Spot) — Ready stock, one-time pickup</option>
                                    <option value="futures">期货 (Futures) — Contract with scheduled deliveries</option>
                                </select>
                            </div>

                            {form.delivery_type === 'futures' && (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Contract Start Date (合同开始日期)</label>
                                            <input className="form-control" type="date" name="contract_start_date" value={form.contract_start_date} onChange={handleChange} />
                                        </div>
                                        <div className="form-group">
                                            <label>Duration (months 月数)</label>
                                            <input className="form-control" type="number" min="1" step="1" name="contract_duration_months" value={form.contract_duration_months} onChange={handleChange} placeholder="12" />
                                        </div>
                                    </div>
                                    {contractEndDate && (
                                        <div className="form-group">
                                            <div style={{ padding: '8px 12px', background: 'var(--bg-inset)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                📅 Contract ends: <strong>{contractEndDate}</strong>
                                            </div>
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label>Delivery Frequency (交货频率)</label>
                                        <select className="form-control" name="delivery_frequency" value={form.delivery_frequency} onChange={handleChange}>
                                            <option value="monthly">Monthly (每月)</option>
                                            <option value="quarterly">Quarterly (每季度)</option>
                                            <option value="weekly">Weekly (每周)</option>
                                            <option value="custom">Custom (自定义)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Delivery Schedule Notes (交货安排)</label>
                                        <textarea
                                            className="form-control"
                                            name="delivery_schedule_notes"
                                            value={form.delivery_schedule_notes}
                                            onChange={handleChange}
                                            rows={3}
                                            placeholder="e.g., 每月第一周取货 500MT，共12次..."
                                        />
                                    </div>
                                </>
                            )}

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Origin Country</label>
                                    <input className="form-control" name="origin_country" value={form.origin_country} onChange={handleChange} placeholder="e.g., Ghana, China, Russia" />
                                </div>
                                <div className="form-group">
                                    <label>Shipping Terms</label>
                                    <input className="form-control" name="shipping_terms" value={form.shipping_terms} onChange={handleChange} placeholder="e.g., CIF, FOB, DDP" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Payment Method</label>
                                <select className="form-control" name="payment_method" value={form.payment_method} onChange={handleChange}>
                                    <option value="">-- Select --</option>
                                    <option value="SBLC">SBLC (Standby Letter of Credit)</option>
                                    <option value="LC">LC (Letter of Credit)</option>
                                    <option value="DLC">DLC (Documentary Letter of Credit)</option>
                                    <option value="BCL">BCL (Bank Comfort Letter)</option>
                                    <option value="Wire Transfer">Wire Transfer</option>
                                    <option value="T/T">T/T (Telegraphic Transfer)</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Date & Status */}
                        <div className="form-section">
                            <div className="form-section-title">📅 Status</div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date Received <span className="required">*</span></label>
                                    <input className="form-control" type="date" name="date_received" value={form.date_received} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select className="form-control" name="status" value={form.status} onChange={handleChange}>
                                        <option value="unassigned">Unassigned</option>
                                        <option value="under_review">Under Review</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Additional Notes</label>
                                <textarea className="form-control" name="additional_notes" value={form.additional_notes} onChange={handleChange} placeholder="Any other important information..." />
                            </div>
                        </div>

                        {/* Documents */}
                        {isEdit ? (
                            <div className="form-section">
                                <DealDocuments dealId={id} />
                            </div>
                        ) : (
                            <div className="form-section">
                                <div className="form-section-title">📎 Documents (optional)</div>
                                <div className="form-group">
                                    <label
                                        className="btn btn-secondary btn-sm"
                                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        + Attach File
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            style={{ display: 'none' }}
                                            onChange={e => { handleFileQueue(e.target.files?.[0]); e.target.value = '' }}
                                        />
                                    </label>
                                    <div className="form-help">PDF or Word (.doc, .docx) — max 10 MB. Files upload when you save the deal.</div>
                                </div>
                                {pendingFiles.length > 0 && (
                                    <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {pendingFiles.map((file, i) => (
                                            <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-inset)', borderRadius: 'var(--radius-md)' }}>
                                                <span style={{ fontSize: '14px' }}>
                                                    {file.type === 'application/pdf' ? '📄' : '📝'} {file.name}
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: '8px' }}>
                                                        {file.size < 1024 * 1024
                                                            ? `${(file.size / 1024).toFixed(1)} KB`
                                                            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                                    </span>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                                                >✕</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                {loading ? 'Saving...' : (isEdit ? '💾 Update Deal' : '💾 Save Deal')}
                            </button>
                            <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}
