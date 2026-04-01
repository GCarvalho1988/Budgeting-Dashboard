// src/components/CommentButton.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CommentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path
      d="M3 4 H23 V18 H13 L9 23 V18 H3 Z"
      stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round"
    />
    <line x1="7" y1="9"  x2="19" y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="7" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export default function CommentButton({ transactionId, existingFlags = [] }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [flags, setFlags] = useState(existingFlags)
  const [saving, setSaving] = useState(false)

  const hasComments = flags.length > 0

  async function submitComment() {
    if (!comment.trim()) return
    setSaving(true)
    const { data } = await supabase.from('flags').insert({
      transaction_id: transactionId,
      user_id: user.id,
      comment: comment.trim(),
      type: 'comment',
    }).select().single()
    if (data) setFlags(f => [...f, data])
    setComment('')
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={hasComments ? `${flags.length} comment(s)` : 'Add a comment'}
        aria-label={hasComments ? `${flags.length} comment(s)` : 'Add a comment'}
        className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
          hasComments
            ? 'border-[#DC9F85] text-[#DC9F85]'
            : 'border-[#35211A] text-[#66473B] hover:border-[#DC9F85] hover:text-[#DC9F85]'
        }`}
      >
        <CommentIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-72 bg-[#181818] border border-[#66473B] rounded p-4 shadow-xl">
          {flags.length > 0 && (
            <div className="mb-3 space-y-2">
              {flags.map(f => (
                <div key={f.id} className="text-xs border border-[#35211A] rounded p-2 text-[#B6A596]">
                  {f.comment}
                </div>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full bg-transparent border border-[#66473B] rounded px-3 py-2 text-sm text-[#EBDCC4] placeholder-[#66473B] resize-none focus:outline-none focus:border-[#DC9F85] mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border border-[#66473B] text-[#B6A596] rounded py-1.5 text-xs hover:border-[#B6A596] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitComment}
              disabled={saving}
              className="flex-1 bg-[#DC9F85] text-[#181818] rounded py-1.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
