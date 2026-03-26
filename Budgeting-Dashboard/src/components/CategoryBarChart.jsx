import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLOURS = ['#DC9F85','#B6A596','#c4856a','#9a8070','#e8b89d','#8a6555','#d4a090','#7a5040']

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#181818] border border-[#66473B] rounded px-3 py-2 text-xs text-[#EBDCC4]">
      <p className="text-[#B6A596] mb-1">{label}</p>
      <p>£{Number(payload[0].value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
    </div>
  )
}

export default function CategoryBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 140, right: 20 }}>
        <XAxis
          type="number"
          tickFormatter={v => `£${v}`}
          tick={{ fontSize: 11, fill: '#B6A596' }}
          axisLine={{ stroke: '#35211A' }}
          tickLine={{ stroke: '#35211A' }}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 11, fill: '#B6A596' }}
          width={140}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(220,159,133,0.06)' }} />
        <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
