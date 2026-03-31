import { useState } from 'react';
import { addEvent, deleteEvent } from '../hooks/useApi.js';

function fmtEventDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export default function EventManager({ events, onEventsChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: '', name: '', type: 'work' });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleAdd = async () => {
    if (!form.date || !form.name.trim()) return;
    await addEvent(form);
    setForm({ date: '', name: '', type: 'work' });
    setAdding(false);
    onEventsChange();
  };

  const handleDelete = async (date) => {
    await deleteEvent(date);
    onEventsChange();
  };

  return (
    <div className="event-manager">
      <div className="section-label">Key Events</div>
      <div className="event-list">
        {events.map(e => (
          <div key={e.date} className="event-item">
            <div className={`event-dot event-dot-${e.type}`} />
            <span className="event-name" title={e.name}>{e.name}</span>
            <span className="event-date">{fmtEventDate(e.date)}</span>
            <button className="event-delete" onClick={() => handleDelete(e.date)} title="Remove">✕</button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="event-form">
          <input
            type="date"
            className="event-input"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
          <input
            type="text"
            className="event-input"
            placeholder="Event name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select className="event-input" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="work">Work</option>
            <option value="ride">Ride</option>
            <option value="personal">Personal</option>
          </select>
          <div className="event-form-buttons">
            <button className="btn-primary-sm" onClick={handleAdd}>Add</button>
            <button className="btn-secondary-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="add-event-btn" onClick={() => setAdding(true)}>+ Add event</button>
      )}
    </div>
  );
}
