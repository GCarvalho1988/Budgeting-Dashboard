import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

const mockUnsubscribe = vi.fn()
const mockSignIn = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      get getSession() { return mockGetSession },
      get onAuthStateChange() { return mockOnAuthStateChange },
      get signInWithPassword() { return mockSignIn },
      get signOut() { return mockSignOut },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        }),
      }),
    }),
  },
}))

beforeEach(() => {
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
  mockSignIn.mockResolvedValue({ error: null })
  mockSignOut.mockResolvedValue({})
})

function TestConsumer() {
  const { user, role, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `role:${role}` : 'not-signed-in'}</div>
}

describe('AuthContext', () => {
  it('shows loading then resolves to not-signed-in when no session', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('not-signed-in')).toBeInTheDocument())
  })

  it('signIn returns null error on success', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    function SignInConsumer() {
      const { signIn } = useAuth()
      return <button onClick={() => signIn('a@b.com', 'pass')}>sign in</button>
    }
    render(<AuthProvider><SignInConsumer /></AuthProvider>)
    await userEvent.click(screen.getByText('sign in'))
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' })
  })

  it('signIn returns error on failure', async () => {
    const fakeError = new Error('Invalid credentials')
    mockSignIn.mockResolvedValue({ error: fakeError })
    let capturedError
    function SignInConsumer() {
      const { signIn } = useAuth()
      return <button onClick={async () => { capturedError = await signIn('a@b.com', 'wrong') }}>sign in</button>
    }
    render(<AuthProvider><SignInConsumer /></AuthProvider>)
    await userEvent.click(screen.getByText('sign in'))
    expect(capturedError).toBe(fakeError)
  })
})

describe('ProtectedRoute', () => {
  it('useAuth throws when used outside AuthProvider', () => {
    function Bare() { useAuth(); return null }
    expect(() => render(<Bare />)).toThrow('useAuth must be used within AuthProvider')
  })
})
