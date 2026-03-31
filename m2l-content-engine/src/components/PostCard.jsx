const TYPE_ICONS = {
  story:     '📖',
  milestone: '🏔️',
  ask:       '🙏',
  thank:     '❤️',
  training:  '🚴',
};

export default function PostCard({ draft, selected, onClick }) {
  return (
    <div
      className={`post-card${selected ? ' selected' : ''}`}
      onClick={onClick}
      title={draft.title}
    >
      <span className="post-icon">{TYPE_ICONS[draft.content_type] ?? '📄'}</span>
      <span className="post-title">{draft.title}</span>
      <div className={`status-dot status-${draft.status}`} />
    </div>
  );
}
