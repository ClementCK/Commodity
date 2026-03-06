import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const initialized = useRef(false)

    useEffect(() => {
        // Prevent double-init in React StrictMode
        if (initialized.current) return
        initialized.current = true

        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[Auth] event:', event)
                if (event === 'SIGNED_IN' && session?.user) {
                    setUser(session.user)
                    const p = await loadProfile(session.user.id)
                    setProfile(p)
                    setLoading(false)
                } else if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                    // Keep same object reference if ID unchanged — prevents unnecessary
                    // useEffect([user]) re-runs in Dashboard, Kanban, etc.
                    setUser(prev => prev?.id === session.user.id ? prev : session.user)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    async function init() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user)
                const p = await loadProfile(session.user.id)
                setProfile(p)
            }
        } catch (err) {
            console.error('[Auth] init error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) {
                console.warn('[Auth] profile fetch error:', error.message)
                return { id: userId, role: 'user', email: '', full_name: '' }
            }
            return data
        } catch (err) {
            console.warn('[Auth] profile fetch exception:', err)
            return { id: userId, role: 'user', email: '', full_name: '' }
        }
    }

    async function signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        })
        return { data, error }
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { data, error }
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    const isAdmin = profile?.role === 'admin'

    return (
        <AuthContext.Provider value={{ user, profile, loading, isAdmin, signUp, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}
