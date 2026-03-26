import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded px-3 py-2 text-xs text-[#EBDCC4]">
      <p className="text-[#B6A596] mb-1">{label}</p>
      <p>£{Number(payload[0].value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
    </div>
  )
}

export default function MonthlyTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#35211A" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={{ stroke: '#35211A' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `£${v}`}
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#DC9F85"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#DC9F85', stroke: '#181818', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
