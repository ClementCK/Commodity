import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mimeType) {
    return mimeType === 'application/pdf' ? '📄' : '📝'
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DealDocuments({ dealId }) {
    const { user, isAdmin } = useAuth()
    const toast = useToast()

    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

    useEffect(() => { loadDocuments() }, [dealId])

    async function loadDocuments() {
        const { data, error } = await supabase
            .from('deal_documents')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[DealDocuments] load error:', error.message)
        }
        setDocuments(data || [])
        setLoading(false)
    }

    function handleFileSelect(file) {
        if (!file) return
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            toast.error('Only PDF and Word documents (.pdf, .doc, .docx) are allowed')
            return
        }
        if (file.size > MAX_BYTES) {
            toast.error(`File must be smaller than 10 MB (this file is ${formatBytes(file.size)})`)
            return
        }
        uploadFile(file)
    }

    async function uploadFile(file) {
        setUploading(true)
        try {
            const storagePath = `${dealId}/${crypto.randomUUID()}-${file.name}`

            const { error: storageError } = await supabase.storage
                .from('deal-documents')
                .upload(storagePath, file, { upsert: false })

            if (storageError) {
                toast.error(`Upload failed: ${storageError.message}`)
                return
            }

            const { error: dbError } = await supabase
                .from('deal_documents')
                .insert({
                    deal_id: dealId,
                    uploaded_by: user.id,
                    file_name: file.name,
                    storage_path: storagePath,
                    file_size: file.size,
                    mime_type: file.type,
                })

            if (dbError) {
                // Roll back the storage file so we don't leave orphans
                await supabase.storage.from('deal-documents').remove([storagePath])
                toast.error(`Upload failed: ${dbError.message}`)
                return
            }

            toast.success('Document uploaded')
            await loadDocuments()
        } finally {
            setUploading(false)
            // Reset the file input so the same file can be re-selected if needed
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleView(doc) {
        const { data, error } = await supabase.storage
            .from('deal-documents')
            .createSignedUrl(doc.storage_path, 60)

        if (error || !data?.signedUrl) {
            toast.error('Could not generate download link. Please try again.')
            return
        }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    }

    async function handleDeleteExecute(doc) {
        // Delete DB row first — RLS enforces ownership here
        const { error: dbError } = await supabase
            .from('deal_documents')
            .delete()
            .eq('id', doc.id)

        if (dbError) {
            toast.error('Failed to delete document')
            return
        }

        // Remove storage file (non-fatal if this fails — the DB row is already gone)
        const { error: storageError } = await supabase.storage
            .from('deal-documents')
            .remove([doc.storage_path])

        if (storageError) {
            console.warn('[DealDocuments] storage cleanup failed:', storageError.message)
        }

        setDeleteTarget(null)
        toast.success('Document deleted')
        await loadDocuments()
    }

    const canDelete = (doc) => user?.id === doc.uploaded_by || isAdmin

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Documents</h3>
                <label
                    style={{
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}
                    className="btn btn-secondary btn-sm"
                >
                    {uploading ? 'Uploading...' : '+ Upload'}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={e => handleFileSelect(e.target.files?.[0])}
                    />
                </label>
            </div>

            <div
                className="card-body"
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                    e.preventDefault()
                    setDragOver(false)
                    handleFileSelect(e.dataTransfer.files?.[0])
                }}
                style={dragOver ? { outline: '2px dashed var(--primary-400)', outlineOffset: '-4px', borderRadius: 'var(--radius-md)' } : undefined}
            >
                {loading ? (
                    <div className="loading-spinner"><div className="spinner" /></div>
                ) : documents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📎</div>
                        <p style={{ margin: 0 }}>No documents yet. Click <strong>+ Upload</strong> or drag &amp; drop a PDF or Word file here.</p>
                    </div>
                ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {documents.map(doc => (
                            <li
                                key={doc.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 12px',
                                    background: 'var(--bg-inset)',
                                    borderRadius: 'var(--radius-md)',
                                    gap: '12px',
                                }}
                            >
                                {/* Left: icon + name + meta */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{fileIcon(doc.mime_type)}</span>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {doc.file_name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {formatBytes(doc.file_size)} &middot; {formatDate(doc.created_at)}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleView(doc)}
                                    >
                                        View
                                    </button>

                                    {canDelete(doc) && (
                                        deleteTarget?.id === doc.id ? (
                                            <>
                                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Delete?</span>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExecute(doc)}>Yes</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>No</button>
                                            </>
                                        ) : (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                title="Delete document"
                                                onClick={() => setDeleteTarget(doc)}
                                            >
                                                🗑
                                            </button>
                                        )
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
