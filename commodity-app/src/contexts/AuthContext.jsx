import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    // Tracks which user ID's profile is already loaded/loading.
    // Shared between getSession() and onAuthStateChange so neither
    // fires a duplicate loadProfile() for the same user.
    const loadedProfileId = useRef(null)

    useEffect(() => {
        // Safety net: if nothing resolves loading within 8 seconds, clear it.
        // This prevents an infinite spinner if Supabase is unreachable.
        const safetyTimer = setTimeout(() => setLoading(false), 8000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                clearTimeout(safetyTimer)

                if (session?.user) {
                    setUser(prev => prev?.id === session.user.id ? prev : session.user)

                    if (
                        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
                        loadedProfileId.current !== session.user.id
                    ) {
                        loadedProfileId.current = session.user.id
                        const p = await loadProfile(session.user.id)
                        setProfile(p)
                    }
                } else {
                    setUser(null)
                    setProfile(null)
                    loadedProfileId.current = null
                }

                setLoading(false)
            }
        )

        // getSession() reads the session from localStorage immediately — faster
        // than waiting for an onAuthStateChange event on cold starts.
        async function init() {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.user && loadedProfileId.current !== session.user.id) {
                    setUser(prev => prev?.id === session.user.id ? prev : session.user)
                    loadedProfileId.current = session.user.id
                    const p = await loadProfile(session.user.id)
                    setProfile(p)
                }
            } catch (err) {
                console.error('[Auth] init error:', err)
            } finally {
                clearTimeout(safetyTimer)
                setLoading(false)
            }
        }

        init()

        return () => {
            clearTimeout(safetyTimer)
            subscription.unsubscribe()
        }
    }, [])

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
