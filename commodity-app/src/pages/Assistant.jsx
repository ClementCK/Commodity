import { useState, useEffect, useRef } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function Assistant() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState(null)
    const [deals, setDeals] = useState([])
    const [loadingDeals, setLoadingDeals] = useState(true)
    const messagesEndRef = useRef(null)
    const toast = useToast()

    useEffect(() => {
        loadSettings()
        loadChatHistory()
        loadDeals()
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    function loadSettings() {
        const saved = localStorage.getItem('app_settings')
        if (saved) {
            try {
                setSettings(JSON.parse(saved))
            } catch (e) {
                setSettings(getDefaultSettings())
            }
        } else {
            setSettings(getDefaultSettings())
        }
    }

    function getDefaultSettings() {
        return {
            gemini_api_key: 'AIzaSyBpg2yq48fDInDAlS9CXFLuGd3mlMgrAxs',
            ai_model: 'gemini-3-pro-preview',
            ai_temperature: '0.7',
            ai_max_tokens: '8192',
            ai_top_p: '0.95',
            ai_top_k: '40',
            system_prompt: `You are an expert AI assistant for a Commodity Deal Tracking system. Your role is to help analyze deals, provide market insights, and answer questions about commodity transactions.

You have access to the complete database of deals in the system. Use this data to:
- Answer specific questions about deals
- Analyze trends and patterns
- Compare different deals and sources
- Provide risk assessments
- Suggest opportunities
- Generate reports and summaries

Always be accurate, data-driven, and cite specific deal IDs when referencing deals. Be helpful and provide actionable insights.`
        }
    }

    async function loadDeals() {
        try {
            const { data, error } = await supabase
                .from('deals')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000)

            if (error) {
                console.warn('Could not load deals from Supabase:', error.message)
                setDeals([])
            } else {
                setDeals(data || [])
            }
        } catch (err) {
            console.warn('Error loading deals:', err)
            setDeals([])
        } finally {
            setLoadingDeals(false)
        }
    }

    function loadChatHistory() {
        const history = localStorage.getItem('chat_history')
        if (history) {
            try {
                setMessages(JSON.parse(history))
            } catch (e) {
                setMessages([])
            }
        }
    }

    function formatDealsContext() {
        if (deals.length === 0) {
            return "No deals currently in the database."
        }

        const dealsContext = deals.map((deal, index) => {
            return `Deal #${deal.id}:
- Commodity: ${deal.commodity_type || 'N/A'}
- Source: ${deal.source_name || 'N/A'}
- Price: ${deal.price || 'N/A'} ${deal.price_currency || ''}
- Quantity: ${deal.quantity || 'N/A'} ${deal.quantity_unit || ''}
- Origin: ${deal.origin_country || 'N/A'}
- Status: ${deal.status || 'N/A'}
- AI Score: ${deal.ai_score || 'Not scored'}
- Date Received: ${deal.date_received || 'N/A'}
- Payment: ${deal.payment_method || 'N/A'}
- Shipping: ${deal.shipping_terms || 'N/A'}
${deal.additional_notes ? '- Notes: ' + deal.additional_notes : ''}`
        }).join('\n\n')

        return `CURRENT DEALS DATABASE (${deals.length} deals):

${dealsContext}`
    }

    async function sendMessage() {
        if (!input.trim() || !settings) return

        // Reload deals to get latest data
        await loadDeals()

        const userMessage = { role: 'user', content: input, timestamp: new Date().toISOString() }
        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        setInput('')
        setLoading(true)

        try {
            const apiKey = settings.gemini_api_key
            if (!apiKey) {
                toast.error('Please configure Gemini API key in Settings')
                setLoading(false)
                return
            }

            const genAI = new GoogleGenerativeAI(apiKey)
            const modelName = settings.ai_model || 'gemini-3-pro-preview'
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: settings.system_prompt || getDefaultSettings().system_prompt
            })

            const generationConfig = {
                temperature: parseFloat(settings.ai_temperature) || 0.7,
                maxOutputTokens: parseInt(settings.ai_max_tokens) || 8192,
                topP: parseFloat(settings.ai_top_p) || 0.95,
                topK: parseInt(settings.ai_top_k) || 40,
            }

            // Build chat with deals context
            const dealsContext = formatDealsContext()
            const contextualizedInput = `${dealsContext}

USER QUESTION: ${input}`

            const history = newMessages.slice(-10).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }))

            const chat = model.startChat({
                history: history.slice(0, -1),
                generationConfig
            })

            const result = await chat.sendMessage(contextualizedInput)
            const response = result.response.text()

            const assistantMessage = {
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            }

            const updatedMessages = [...newMessages, assistantMessage]
            setMessages(updatedMessages)
            localStorage.setItem('chat_history', JSON.stringify(updatedMessages))

        } catch (error) {
            console.error('Chat error:', error)
            toast.error(error.message || 'Failed to get response from AI')
            setLoading(false)
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

    async function refreshDeals() {
        setLoadingDeals(true)
        await loadDeals()
        toast.success(`Loaded ${deals.length} deals from database`)
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>🤖 AI Assistant</h1>
                    <p className="subtitle">
                        {loadingDeals ? 'Loading deals...' : `${deals.length} deals loaded • ${settings?.ai_model || 'Gemini AI'}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost btn-sm" onClick={refreshDeals} disabled={loadingDeals}>
                        🔄 Refresh Deals
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={clearChat}>
                        🗑 Clear Chat
                    </button>
                </div>
            </div>

            <div className="card" style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                            <h2>👋 Hello!</h2>
                            <p>I'm your AI assistant with access to <strong>{deals.length} deals</strong> in the database.</p>
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
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
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
                                    {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
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
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                background: 'var(--bg-inset)',
                                color: 'var(--text-secondary)'
                            }}>
                                <div style={{ fontSize: '14px', marginBottom: '4px' }}>🤖 Assistant</div>
                                Analyzing {deals.length} deals...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div style={{
                    borderTop: '1px solid var(--border-primary)',
                    padding: '16px',
                    background: 'var(--bg-primary)'
                }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <textarea
                            className="form-control"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask about deals, trends, analysis... (Press Enter to send)"
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
                            {loading ? '⏳ Analyzing...' : '📤 Send'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
