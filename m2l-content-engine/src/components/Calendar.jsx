import { useMemo } from 'react';
import PostCard from './PostCard.jsx';

function weekStartDate(campaignStart, weekNum) {
  const d = new Date(campaignStart);
  d.setDate(d.getDate() + (weekNum - 1) * 7);
  return d;
}

function weekEndDate(campaignStart, weekNum) {
  const d = weekStartDate(campaignStart, weekNum);
  d.setDate(d.getDate() + 6);
  return d;
}

function fmtShort(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekPhase(phases, weekNum) {
  return phases.find(p => p.weeks.includes(weekNum)) ?? null;
}

function eventsInWeek(keyEvents, campaignStart, weekNum) {
  const start = weekStartDate(campaignStart, weekNum);
  const end   = weekEndDate(campaignStart, weekNum);
  return keyEvents.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

export default function Calendar({
  campaign, drafts, currentWeek, phaseFilter, onSelectDraft, selectedDraft
}) {
  const allWeeks = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 1), []);

  const visibleWeeks = phaseFilter
    ? allWeeks.filter(w => getWeekPhase(campaign.phases, w)?.id === phaseFilter)
    : allWeeks;

  const draftsByWeek = useMemo(() => {
    const map = {};
    drafts.forEach(d => {
      if (!map[d.week]) map[d.week] = [];
      map[d.week].push(d);
    });
    return map;
  }, [drafts]);

  let lastPhaseId = null;

  return (
    <div className="calendar">
      {visibleWeeks.map(weekNum => {
        const phase = getWeekPhase(campaign.phases, weekNum);
        const phaseChanged = phase?.id !== lastPhaseId;
        const isFirst = weekNum === visibleWeeks[0];
        if (phase) lastPhaseId = phase.id;

        const start = weekStartDate(campaign.campaign_start, weekNum);
        const end   = weekEndDate(campaign.campaign_start, weekNum);
        const events = eventsInWeek(campaign.key_events, campaign.campaign_start, weekNum);
        const weekDrafts = draftsByWeek[weekNum] ?? [];
        const isCurrent = weekNum === currentWeek;

        return (
          <div key={weekNum}>
            {phaseChanged && !isFirst && (
              <div className={`phase-separator phase-separator-${phase?.id ?? ''}`}>
                {phase?.label}
              </div>
            )}
            <div className={`week-row${isCurrent ? ' current-week' : ''}`}>
              <div className={`week-badge phase-bg-${phase?.id ?? 'push'}`}>{weekNum}</div>
              <div className="week-dates">{fmtShort(start)}–{fmtShort(end)}</div>
              {events.map(e => (
                <span key={e.date} className={`event-pin event-pin-${e.type}`}>
                  {e.name}
                </span>
              ))}
              <div className="post-cards">
                {weekDrafts.length === 0 ? (
                  <span className="no-posts">No posts planned</span>
                ) : (
                  weekDrafts.map(d => (
                    <PostCard
                      key={d.filename}
                      draft={d}
                      selected={selectedDraft?.filename === d.filename}
                      onClick={() => onSelectDraft(d)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
