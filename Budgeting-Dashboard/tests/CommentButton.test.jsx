import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/lib/supabase', () => {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return { supabase: { from: vi.fn().mockReturnValue(chain), _chain: chain } }
})

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

import CommentButton from '../src/components/CommentButton'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  supabase._chain.insert.mockReturnThis()
  supabase._chain.select.mockReturnThis()
})

describe('CommentButton', () => {
  it('renders uncommented by default', () => {
    render(<CommentButton transactionId="tx-1" />)
    const btn = screen.getByTitle('Add a comment')
    expect(btn).toBeInTheDocument()
  })

  it('shows comment count in title when comments exist', () => {
    render(<CommentButton transactionId="tx-1" existingFlags={[{ id: 'f1', comment: 'check this' }]} />)
    expect(screen.getByTitle('1 comment(s)')).toBeInTheDocument()
  })

  it('opens comment panel when clicked', async () => {
    render(<CommentButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Add a comment'))
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
  })

  it('submits comment and closes panel', async () => {
    supabase._chain.single.mockResolvedValue({
      data: { id: 'f2', comment: 'suspicious', user_id: 'user-1' },
    })
    render(<CommentButton transactionId="tx-1" />)
    await userEvent.click(screen.getByTitle('Add a comment'))
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), 'suspicious')
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument()
    )
  })
})
