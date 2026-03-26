export default function KpiCard({ label, value, delta, deltaLabel }) {
  const positive = delta > 0
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded p-5">
      <p
        className="text-xs font-medium text-[#B6A596] uppercase tracking-widest"
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold text-[#EBDCC4] mt-2"
        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
      >
        {value}
      </p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${positive ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}
