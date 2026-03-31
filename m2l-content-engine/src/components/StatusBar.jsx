import { useState } from 'react';
import { updateCampaign } from '../hooks/useApi.js';

const STATUSES = ['draft', 'ready', 'posted', 'skipped'];

export default function StatusBar({ campaign, drafts, weekNum, currentPhase, daysUntilRide, onCampaignUpdate }) {
  const [editing, setEditing] = useState(false);
  const [raisedInput, setRaisedInput] = useState(String(campaign.current_raised));

  const target = campaign.ride.fundraising_target;
  const pct = Math.min(100, Math.round((campaign.current_raised / target) * 100));

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = drafts.filter(d => d.status === s).length;
    return acc;
  }, {});

  const saveRaised = async () => {
    const val = Number(raisedInput);
    if (!isNaN(val)) {
      await updateCampaign({ ...campaign, current_raised: val });
      onCampaignUpdate();
    }
    setEditing(false);
  };

  return (
    <div className="status-bar">
      <div className="section-label">Status</div>
      <div className="countdown">
        <strong>{daysUntilRide}</strong>
        <span>days until ride</span>
      </div>
      <div className="week-phase">Week {weekNum} · {currentPhase?.label ?? '—'}</div>

      <div>
        <div className="raised-row">
          {editing ? (
            <>
              <span style={{ color: '#888' }}>£</span>
              <input
                type="number"
                className="raised-input"
                value={raisedInput}
                onChange={e => setRaisedInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveRaised()}
                onBlur={saveRaised}
                autoFocus
              />
            </>
          ) : (
            <span
              className="raised-value"
              onClick={() => { setRaisedInput(String(campaign.current_raised)); setEditing(true); }}
              title="Click to edit"
            >
              £{campaign.current_raised.toLocaleString('en-GB')} raised
            </span>
          )}
          <span className="raised-target"> / £{target.toLocaleString('en-GB')}</span>
        </div>
        <div className="progress-bar-outer">
          <div className="progress-bar-inner" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="status-counts">
        {STATUSES.map(s => (
          <div key={s} className="status-count">
            <span className="count-num">{counts[s]}</span>
            <span className="count-lbl">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
