export default function PhaseTimeline({ phases, activeFilter, onFilterChange }) {
  return (
    <div className="phase-timeline">
      {phases.map(p => (
        <div
          key={p.id}
          className={`phase-seg phase-seg-${p.id}${activeFilter === p.id ? ' active' : ''}`}
          style={{ flex: p.weeks.length }}
          onClick={() => onFilterChange(activeFilter === p.id ? null : p.id)}
          title={`Click to filter to ${p.label}`}
        >
          {p.label} · Wk {p.weeks[0]}–{p.weeks[p.weeks.length - 1]}
        </div>
      ))}
    </div>
  );
}
