// The default avatar: a pair of trousers seen from behind, with a waistband,
// a centre seam and two back pockets. The wash is picked from the handle so
// a page of new members is not a wall of identical blue.
const WASHES = [
  ["#3f63a8", "#2f4c84"],
  ["#2b3a63", "#1f2b4a"],
  ["#8a6a4c", "#6e533b"],
  ["#5b6b4f", "#46533d"],
  ["#b05038", "#8c3f2c"],
  ["#4a505c", "#363b45"],
  ["#6b5a8c", "#52456d"],
];

function wash(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return WASHES[n % WASHES.length];
}

export function BehindMark({ seed = "", size = 28 }: { seed?: string; size?: number }) {
  const [body, dark] = wash(seed);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="11" y="10" width="42" height="9" rx="3" fill={dark} />
      <path
        d="M11 19h42v9c0 15-9 27-21 27S11 43 11 28z"
        fill={body}
      />
      <path d="M32 19v34" stroke={dark} strokeWidth="2" />
      <rect x="16.5" y="24" width="11" height="10" rx="2.5" fill={dark} />
      <rect x="36.5" y="24" width="11" height="10" rx="2.5" fill={dark} />
      <path
        d="M18 26.5h8M38 26.5h8"
        stroke="#e7b36a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
