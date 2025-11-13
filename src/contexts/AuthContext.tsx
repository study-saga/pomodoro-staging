import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk'

// Discord Activity authentication (for Discord iframe)
import { authenticateDiscordUser, type DiscordUser } from '../lib/discordAuth'
import { syncDiscordUserToSupabase, type AppUser as DiscordAppUser } from '../lib/userSync'

// Web authentication (for base website)
import { authenticateWithSupabase, onAuthStateChange, signOut as supabaseSignOut } from '../lib/supabaseAuth'
import type { AppUser as SupabaseAppUser } from '../lib/supabaseAuth'

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
      authenticateWeb()

      // Listen for auth state changes (handles OAuth callbacks on web only)
      const { data: { subscription } } = onAuthStateChange(async (newSession) => {
        console.log('[Auth] Auth state changed:', newSession ? 'signed in' : 'signed out')

        if (newSession) {
          setSession(newSession)
          setUser(newSession.user)
          setAuthenticated(true)

          // Fetch updated user profile
          try {
            const result = await authenticateWithSupabase()
            setAppUser(result.appUser)
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
