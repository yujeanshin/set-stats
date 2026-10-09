// One Set card, drawn the way Set with Friends draws it, then turned to
// vertical. From ekzhang/setwithfriends at commit
// dcd104cca74b06e8ebc396876e8c7e0e97c5d805 (MIT):
//   - the oval and diamond paths, the stripe pattern and mask: index.html
//     (the squiggle path is SQUIGGLE_PATH, from the same file)
//   - card and symbol layout (160 x 100 card, 36 x 72 symbols with 3px
//     margins, 1px border, radius 6, fill plus 18-unit stroke):
//     src/components/SetCard.js
//   - card colors: lightTheme.custom.setCard in src/themes.js
// The site lays the symbols out side by side on a wide card; this draws the
// same card and rotates it a quarter turn, stripes and all.
import { useId } from "react";
import { cardFace, describeCard } from "../cardFace.js";
import { SQUIGGLE_PATH } from "./SquiggleIcon.jsx";

export const CARD_COLORS = {
  purple: "#800080",
  green: "#008002",
  red: "#ff0101",
};

const PATHS = {
  squiggle: SQUIGGLE_PATH,
  oval: "m11.49999,95.866646c0,-44.557076 37.442923,-81.999998 82.000002,-81.999998l12.000015,0c44.557076,0 81.999992,37.442923 81.999992,81.999998l0,206.133354c0,44.557098 -37.442917,82 -81.999992,82l-12.000015,0c-44.557079,0 -82.000002,-37.442902 -82.000002,-82l0,-206.133354z",
  diamond:
    "m98.544521,10.311863l-87.830189,189.330815l88.201143,189.644391l88.942329,-190.362741l-89.313283,-188.612465z",
};

// The site's card, in its own pixels: symbols are 200 x 400 user units
// scaled to 36 x 72, each with a 3px margin, centred in a 160 x 100 card.
const W = 160;
const H = 100;
const SYMBOL_SCALE = 36 / 200;
const SYMBOL_BOX = 36 + 2 * 3;

/**
 * A card, vertical: `width` px wide and 1.6 times as tall. Extra props go to
 * the <svg> (style, className, ...).
 */
export default function SetCard({ card, width = 60, ...props }) {
  const { color, shape, shade, number } = cardFace(card);
  const fill = CARD_COLORS[color];
  // Each card has its own mask id; useId's characters are not all valid in
  // url(#...), so keep only the safe ones.
  const maskId = `stripe-${useId().replace(/[^\w-]/g, "")}`;
  const left = (W - number * SYMBOL_BOX) / 2 + 3;
  return (
    <svg
      width={width}
      height={width * 1.6}
      viewBox={`0 0 ${H} ${W}`}
      role="img"
      aria-label={describeCard(card)}
      {...props}
    >
      {shade === "striped" ? (
        <defs>
          <pattern
            id={`${maskId}-p`}
            width="2"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <rect width="2" height="8" fill="#fff" />
          </pattern>
          <mask id={maskId}>
            <rect width="200" height="400" fill={`url(#${maskId}-p)`} />
          </mask>
        </defs>
      ) : null}
      {/* Wide card coordinates, turned a quarter clockwise into the tall box. */}
      <g transform={`translate(${H} 0) rotate(90)`}>
        <rect
          x="0.5"
          y="0.5"
          width={W - 1}
          height={H - 1}
          rx="6"
          fill="#fff"
          stroke="rgba(0, 0, 0, 0.87)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {Array.from({ length: number }, (_, i) => (
          <g
            key={i}
            transform={`translate(${left + i * SYMBOL_BOX} ${(H - 72) / 2}) scale(${SYMBOL_SCALE})`}
          >
            {shade !== "empty" ? (
              <path
                d={PATHS[shape]}
                fill={fill}
                mask={shade === "striped" ? `url(#${maskId})` : undefined}
              />
            ) : null}
            <path d={PATHS[shape]} fill="none" stroke={fill} strokeWidth={18} />
          </g>
        ))}
      </g>
    </svg>
  );
}
