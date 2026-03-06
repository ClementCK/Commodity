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

        // onAuthStateChange is the single source of truth for auth state.
        // INITIAL_SESSION fires immediately with the stored session (or null).
        // This replaces a separate getSession() call and eliminates the race
        // condition where both init() and SIGNED_IN ran concurrently.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    // Keep stable object reference when ID is unchanged —
                    // prevents useEffect([user?.id]) hooks from re-running unnecessarily
                    setUser(prev => prev?.id === session.user.id ? prev : session.user)

                    // Only reload profile on events that change user identity.
                    // TOKEN_REFRESHED only updates the JWT — name/role don't change.
                    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                        const p = await loadProfile(session.user.id)
                        setProfile(p)
                    }
                } else {
                    setUser(null)
                    setProfile(null)
                }

                // Always resolve the loading gate so ProtectedRoute can render pages
                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
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
