import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function Assistant() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)
    const toast = useToast()

    useEffect(() => {
        loadChatHistory()
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    function loadChatHistory() {
        const history = localStorage.getItem('chat_history')
        if (history) {
            try { setMessages(JSON.parse(history)) } catch { setMessages([]) }
        }
    }

    async function sendMessage() {
        if (!input.trim() || loading) return

        const userMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        setInput('')
        setLoading(true)

        try {
            const { data, error } = await supabase.functions.invoke('chat-assistant', {
                body: {
                    message: input.trim(),
                    history: messages.slice(-10)
                }
            })

            if (error) throw error
            if (data?.error) throw new Error(data.error)

            const assistantMessage = {
                role: 'assistant',
                content: data.content,
                timestamp: new Date().toISOString()
            }

            const updatedMessages = [...newMessages, assistantMessage]
            setMessages(updatedMessages)
            localStorage.setItem('chat_history', JSON.stringify(updatedMessages))

        } catch (err) {
            toast.error(err.message || 'Failed to get AI response')
        } finally {
            setLoading(false)
        }
    }

    function clearChat() {
        if (window.confirm('Clear all chat history?')) {
            setMessages([])
            localStorage.removeItem('chat_history')
            toast.success('Chat history cleared')
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>🤖 AI Assistant</h1>
                    <p className="subtitle">Powered by Claude — ask anything about your deals</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={clearChat}>
                    🗑 Clear Chat
                </button>
            </div>

            <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                            <h2>👋 Hello!</h2>
                            <p>I'm your AI assistant with access to all deals in the database.</p>
                            <p>Ask me about:</p>
                            <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '20px auto' }}>
                                <li>Specific deals or commodities</li>
                                <li>Market trends and analysis</li>
                                <li>Price comparisons</li>
                                <li>Risk assessments</li>
                                <li>Source reliability</li>
                            </ul>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                                maxWidth: '70%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                background: msg.role === 'user' ? 'var(--primary-500)' : 'var(--bg-inset)',
                                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                <div style={{ fontSize: '14px', marginBottom: '4px', opacity: 0.7 }}>
                                    {msg.role === 'user' ? '👤 You' : '🤖 Claude'}
                                </div>
                                {msg.content}
                                <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.5 }}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--bg-inset)', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '14px', marginBottom: '4px' }}>🤖 Claude</div>
                                Thinking...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div style={{ borderTop: '1px solid var(--border-primary)', padding: '16px', background: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <textarea
                            className="form-control"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                            placeholder="Ask about deals, trends, analysis... (Enter to send, Shift+Enter for new line)"
                            rows={2}
                            style={{ flex: 1, resize: 'none' }}
                            disabled={loading}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            style={{ minWidth: '100px' }}
                        >
                            {loading ? '⏳' : '📤 Send'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
