import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
    }).select().single()
    if (data) setFlags(f => [...f, { ...data, user_id: user.id }])
    setComment('')
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title={hasComments ? `${flags.length} comment(s)` : 'Add a comment'}
        className={`text-xs font-medium uppercase tracking-widest px-2.5 py-1 rounded border transition-colors ${
          hasComments
            ? 'border-[#DC9F85] text-[#DC9F85]'
            : 'border-[#66473B] text-[#B6A596] hover:border-[#DC9F85] hover:text-[#DC9F85]'
        }`}
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {hasComments ? `COMMENT (${flags.length})` : 'COMMENT'}
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
