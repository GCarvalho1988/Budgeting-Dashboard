export default function Logo({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rounded square border */}
      <rect
        x="2" y="2" width="24" height="24" rx="4"
        fill="none"
        stroke="#DC9F85"
        strokeWidth="1.5"
      />
      {/* Rising trend line */}
      <line
        x1="9" y1="20" x2="19" y2="8"
        stroke="#DC9F85"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Start dot — coral */}
      <circle cx="9" cy="20" r="2" fill="#DC9F85" />
      {/* End dot — cream */}
      <circle cx="19" cy="8" r="2" fill="#EBDCC4" />
    </svg>
  )
}
