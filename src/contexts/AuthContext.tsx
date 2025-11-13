import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk'

// Discord Activity authentication (for Discord iframe)
import { authenticateDiscordUser, type DiscordUser } from '../lib/discordAuth'
import { syncDiscordUserToSupabase, type AppUser as DiscordAppUser } from '../lib/userSync'

// Web authentication (for base website)
import { authenticateWithSupabase, onAuthStateChange, signOut as supabaseSignOut, fetchOrCreateAppUser } from '../lib/supabaseAuth'
import type { AppUser as SupabaseAppUser } from '../lib/supabaseAuth'
import { supabase } from '../lib/supabase'

// Unified AppUser type
type AppUser = DiscordAppUser | SupabaseAppUser

interface AuthContextType {
  // Authentication state
  authenticated: boolean
  loading: boolean
  error: string | null

  // Environment
  isDiscordActivity: boolean

  // User data (Discord Activity)
  discordUser: DiscordUser | null
  discordSdk: DiscordSDK | DiscordSDKMock | null

  // User data (Web)
  user: User | null
  session: Session | null

  // Common user data
  appUser: AppUser | null

  // Methods
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Check if running inside Discord Activity (iframe)
 */
function isInDiscordActivity(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('frame_id') || params.has('instance_id')
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Discord Activity state
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [discordSdk, setDiscordSdk] = useState<DiscordSDK | DiscordSDKMock | null>(null)

  // Web state
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  // Common state
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [isDiscordActivity] = useState(isInDiscordActivity())

  /**
   * Discord Activity authentication flow
   */
  const authenticateDiscordActivity = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[Auth] Starting Discord Activity authentication...')

      // Step 1: Authenticate with Discord SDK
      const authResult = await authenticateDiscordUser()
      console.log('[Auth] Discord SDK authentication successful')

      // Step 2: Sync to Supabase database (without Supabase Auth)
      const dbUser = await syncDiscordUserToSupabase(authResult.discordUser)
      console.log('[Auth] User synced to database')

      // Step 3: Set state
      setDiscordUser(authResult.discordUser)
      setDiscordSdk(authResult.discordSdk)
      setAppUser(dbUser)
      setAuthenticated(true)

      console.log('[Auth] Discord Activity authentication complete!')
    } catch (err) {
      console.error('[Auth] Discord Activity authentication failed:', err)
      setError(err instanceof Error ? err.message : 'Discord authentication failed')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Check if we're in the middle of an OAuth callback
   */
  const isOAuthCallback = (): boolean => {
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash

    // Supabase adds hash parameters after OAuth redirect
    // Check for access_token or error in hash
    return hash.includes('access_token') ||
           hash.includes('error') ||
           params.has('code')
  }

  /**
   * Web authentication flow (Supabase OAuth)
   */
  const authenticateWeb = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[Auth] Starting web authentication (Supabase OAuth)...')

      // This will either return existing session or redirect to Discord OAuth
      const result = await authenticateWithSupabase()
      console.log('[Auth] Supabase authentication successful')

      // Set state
      setUser(result.user)
      setSession(result.session)
      setAppUser(result.appUser)
      setAuthenticated(true)

      console.log('[Auth] Web authentication complete:', result.appUser.username)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'

      // Don't show error if it's just a redirect message
      if (errorMessage.includes('Redirecting to Discord')) {
        console.log('[Auth] Redirecting to Discord OAuth...')
        return
      }

      console.error('[Auth] Web authentication failed:', err)
      setError(errorMessage)
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Refresh user data
   */
  const refreshUser = async () => {
    if (!appUser) return

    try {
      console.log('[Auth] Refreshing user data...')

      if (isDiscordActivity && discordUser) {
        // Discord Activity: Re-sync from Discord SDK
        const updatedUser = await syncDiscordUserToSupabase(discordUser)
        setAppUser(updatedUser)
      } else if (user) {
        // Web: Re-fetch from Supabase
        const result = await authenticateWithSupabase()
        setAppUser(result.appUser)
      }
    } catch (err) {
      console.error('[Auth] Failed to refresh user:', err)
    }
  }

  /**
   * Sign out
   */
  const handleSignOut = async () => {
    try {
      if (!isDiscordActivity) {
        // Only sign out from Supabase Auth if on web
        await supabaseSignOut()
      }

      // Clear all state
      setUser(null)
      setSession(null)
      setDiscordUser(null)
      setDiscordSdk(null)
      setAppUser(null)
      setAuthenticated(false)

      console.log('[Auth] Signed out successfully')
    } catch (err) {
      console.error('[Auth] Failed to sign out:', err)
    }
  }

  // Authenticate on mount
  useEffect(() => {
    if (isDiscordActivity) {
      console.log('[Auth] Environment: Discord Activity')
      authenticateDiscordActivity()
    } else {
      console.log('[Auth] Environment: Web')

      // Set up auth state change listener first (handles OAuth callbacks)
      const { data: { subscription } } = onAuthStateChange(async (newSession) => {
        console.log('[Auth] Auth state changed:', newSession ? 'signed in' : 'signed out')

        if (newSession) {
          setSession(newSession)
          setUser(newSession.user)
          setAuthenticated(true)
          setLoading(false)

          // Fetch user profile directly (don't call authenticateWithSupabase again)
          // We already have the session, so just fetch the app user
          try {
            const appUser = await fetchOrCreateAppUser(newSession.user)
            setAppUser(appUser)
          } catch (err) {
            console.error('[Auth] Failed to fetch user after auth change:', err)
          }
        } else {
          setSession(null)
          setUser(null)
          setAppUser(null)
          setAuthenticated(false)
        }
      })

      // Check if we're in the middle of an OAuth callback
      if (isOAuthCallback()) {
        console.log('[Auth] OAuth callback detected, waiting for session...')
        // Don't call authenticateWeb() - let the auth state change listener handle it
        // But check after a short delay if no session was established
        setTimeout(async () => {
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          if (!currentSession) {
            console.log('[Auth] OAuth callback did not establish session, retrying...')
            setLoading(false)
            setError('OAuth authentication failed. Please try again.')
          }
        }, 3000) // Wait 3 seconds for OAuth to process
      } else {
        // No OAuth callback - check for existing session or redirect to login
        console.log('[Auth] No OAuth callback, checking for session...')
        authenticateWeb()
      }

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [isDiscordActivity])

  const value: AuthContextType = {
    authenticated,
    loading,
    error,
    isDiscordActivity,
    discordUser,
    discordSdk,
    user,
    session,
    appUser,
    refreshUser,
    signOut: handleSignOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
