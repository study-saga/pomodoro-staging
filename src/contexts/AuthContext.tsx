import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk'
import { authenticateDiscordUser, type DiscordUser } from '../lib/discordAuth'
import { syncDiscordUserToSupabase, type AppUser } from '../lib/userSync'
import { getEnvironment } from '../lib/environment'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  // Authentication state
  authenticated: boolean
  loading: boolean
  error: string | null

  // User data
  discordUser: DiscordUser | null
  appUser: AppUser | null
  discordSdk: DiscordSDK | DiscordSDKMock | null

  // Methods
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [discordSdk, setDiscordSdk] = useState<DiscordSDK | DiscordSDKMock | null>(null)

  const authenticateUser = async () => {
    try {
      setLoading(true)
      setError(null)

      const environment = getEnvironment()
      console.log(`[Auth] Starting authentication flow in ${environment} mode...`)

      if (environment === 'discord') {
        // Discord Activities: Use Discord SDK authentication
        console.log('[Auth] Using Discord SDK authentication')
        const authResult = await authenticateDiscordUser()
        console.log('[Auth] Discord authentication successful')

        const user = await syncDiscordUserToSupabase(authResult.discordUser)
        console.log('[Auth] User synced to database')

        setDiscordUser(authResult.discordUser)
        setAppUser(user)
        setDiscordSdk(authResult.discordSdk)
        setAuthenticated(true)
        console.log('[Auth] Authentication complete!')
      } else {
        // Browser: Use Supabase Auth
        console.log('[Auth] Using Supabase Auth (browser mode)')
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          console.log('[Auth] Supabase session found')

          // Extract Discord data from OAuth metadata
          const metadata = session.user.user_metadata
          const discordUser: DiscordUser = {
            id: metadata.provider_id || metadata.sub,
            username: metadata.custom_claims?.global_name || metadata.full_name || metadata.name || 'User',
            discriminator: '0',
            avatar: metadata.avatar_url,
          }

          const user = await syncDiscordUserToSupabase(discordUser)
          console.log('[Auth] User synced to database')

          setDiscordUser(discordUser)
          setAppUser(user)
          setAuthenticated(true)
          console.log('[Auth] Authentication complete!')
        } else {
          console.log('[Auth] No session found - user needs to log in')
          setAuthenticated(false)
        }
      }
    } catch (err) {
      console.error('[Auth] Authentication failed:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    if (!discordUser) return

    try {
      const user = await syncDiscordUserToSupabase(discordUser)
      setAppUser(user)
    } catch (err) {
      console.error('[Auth] Failed to refresh user:', err)
    }
  }

  // Authenticate on mount
  useEffect(() => {
    authenticateUser()

    // Listen for Supabase auth state changes (browser mode only)
    if (getEnvironment() === 'browser') {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          console.log('[Auth] Supabase auth state changed, re-authenticating')
          authenticateUser()
        } else {
          console.log('[Auth] User signed out')
          setAuthenticated(false)
          setDiscordUser(null)
          setAppUser(null)
        }
      })

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [])

  const value: AuthContextType = {
    authenticated,
    loading,
    error,
    discordUser,
    appUser,
    discordSdk,
    refreshUser,
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
