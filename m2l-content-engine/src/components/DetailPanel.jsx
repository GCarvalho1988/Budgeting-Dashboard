import { useState, useEffect } from 'react';
import { updateDraft, uploadImage } from '../hooks/useApi.js';

const TYPE_ICONS = {
  story: '📖', milestone: '🏔️', ask: '🙏', thank: '❤️', training: '🚴',
};

const STATUSES = ['draft', 'ready', 'posted', 'skipped'];

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DetailPanel({ draft, onClose, onSave }) {
  const [body, setBody]     = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [image, setImage]   = useState('');

  useEffect(() => {
    if (draft) {
      setBody(draft.body ?? '');
      setStatus(draft.status ?? 'draft');
      setImage(draft.image ?? '');
    }
  }, [draft?.filename]);

  if (!draft) {
    return (
      <aside className="detail-panel">
        <div className="detail-empty">Select a post to view and edit</div>
      </aside>
    );
  }

  const charCount = body.length;

  const save = async (overrides = {}) => {
    const updated = { ...draft, body, status, image, ...overrides };
    setSaving(true);
    await updateDraft(draft.filename, updated);
    onSave(updated);
    setSaving(false);
  };

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    await save({ status: newStatus });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { path } = await uploadImage(file);
    setImage(path);
    await save({ image: path });
  };

  const handleImageRemove = async () => {
    setImage('');
    await save({ image: '' });
  };

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <button className="close-btn" onClick={onClose}>✕</button>
        <div className="detail-type-line">
          Week {draft.week} · {draft.day} · {TYPE_ICONS[draft.content_type] ?? '📄'} {draft.content_type}
        </div>
        <h2 className="detail-title">{draft.title}</h2>
        <div className="detail-meta">
          {draft.date           && <span className="meta-chip">{fmtDate(draft.date)}</span>}
          {draft.suggested_time && <span className="meta-chip">{draft.suggested_time}</span>}
          {draft.platform       && <span className="meta-chip">{draft.platform}</span>}
        </div>
      </div>

      <div className="detail-image">
        {image ? (
          <>
            <img
              src={`/api/images/${image.replace('images/', '')}`}
              alt="Post image"
              className="detail-image-preview"
            />
            <button className="btn-secondary image-remove-btn" onClick={handleImageRemove}>
              Remove image
            </button>
          </>
        ) : (
          <label className="btn-secondary image-pick-btn">
            Add image
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImagePick}
            />
          </label>
        )}
      </div>

      <div className="status-toggles">
        {STATUSES.map(s => (
          <button
            key={s}
            className={`status-btn${status === s ? ` active status-active-${s}` : ''}`}
            onClick={() => handleStatusChange(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <textarea
        className="detail-body"
        value={body}
        onChange={e => setBody(e.target.value)}
        spellCheck
      />

      <div className="tips-box">
        <div className="tips-title">LinkedIn Tips</div>
        <p>Best times: Tue–Thu, 8–10am or 12–1pm</p>
        <p>⚠️ Fundraising link → first COMMENT, not post body</p>
        <p className={charCount > 1300 ? 'char-over' : 'char-ok'}>{charCount} / 1,300 chars</p>
      </div>

      <div className="detail-footer">
        <button className="btn-primary" onClick={() => save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn-secondary" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </aside>
  );
}
