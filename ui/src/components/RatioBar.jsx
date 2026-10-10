// A Ratio and its 95% interval as a small bar around a line at 1.0 (chance).
// Log scale, so 0.5 and 2 are the same distance from the line; values past
// the ends are cut off with an arrow.
import { colors } from "../theme.js";
import { ratioText } from "../format.js";

const W = 112;
const H = 16;
const PAD = 5;
const SPAN = Math.log(3); // the bar shows 1/3 to 3

const x = (r) => {
  const t = Math.max(-1, Math.min(1, Math.log(r) / SPAN));
  return PAD + ((t + 1) / 2) * (W - 2 * PAD);
};

/** ratio, low, high as from /api/types; muted greys it for low data. */
export default function RatioBar({ ratio, low, high, muted = false }) {
  if (ratio == null) return null;
  const ink = muted ? colors.muted : colors.text;
  const lo = x(Math.max(low, 1e-9));
  const hi = x(high);
  const mid = H / 2;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`95% interval ${ratioText(low)} to ${ratioText(high)}`}
      style={{ verticalAlign: "middle", flexShrink: 0 }}
    >
      <title>{`95% interval ${ratioText(low)}–${ratioText(high)}`}</title>
      <line
        x1={PAD}
        x2={W - PAD}
        y1={mid}
        y2={mid}
        stroke={colors.border}
        strokeWidth="1"
      />
      <line
        x1={x(1)}
        x2={x(1)}
        y1="1"
        y2={H - 1}
        stroke={colors.muted}
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect
        x={lo}
        y={mid - 3}
        width={Math.max(2, hi - lo)}
        height="6"
        rx="3"
        fill={muted ? colors.scale[0] : colors.scale[2]}
      />
      {high > 3 ? (
        <path
          d={`M${W - PAD} ${mid - 4} L${W - 1} ${mid} L${W - PAD} ${mid + 4}Z`}
          fill={ink}
        />
      ) : null}
      {low < 1 / 3 ? (
        <path
          d={`M${PAD} ${mid - 4} L1 ${mid} L${PAD} ${mid + 4}Z`}
          fill={ink}
        />
      ) : null}
      <circle cx={x(ratio)} cy={mid} r="3.5" fill={ink} />
    </svg>
  );
}
