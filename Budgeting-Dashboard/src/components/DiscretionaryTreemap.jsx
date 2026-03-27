// src/components/DiscretionaryTreemap.jsx
import { Treemap, ResponsiveContainer } from 'recharts'

const PALETTE = [
  '#DC9F85', '#B6A596', '#9a8070',
  '#66473B', '#C4A882', '#8B7355',
  '#EBDCC4', '#A08060',
]

function Cell({ x, y, width, height, name, value, fill }) {
  const showLabel = width > 50 && height > 24
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#181818" strokeWidth={2} />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={600}
            fill="#181818"
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill="#181818"
            style={{ pointerEvents: 'none' }}
          >
            £{Number(value).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
          </text>
        </>
      )}
    </g>
  )
}

export default function DiscretionaryTreemap({ data }) {
  const colored = data.map((item, i) => ({
    ...item,
    fill: PALETTE[i % PALETTE.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <Treemap
        data={colored}
        dataKey="size"
        nameKey="name"
        content={Cell}
      />
    </ResponsiveContainer>
  )
}
