// The Set squiggle, drawn the way Set with Friends draws it: the path is the
// #squiggle symbol from ekzhang/setwithfriends public/index.html (MIT), and
// the fill plus 18-unit stroke match its ResponsiveSetCard symbols.

export const SQUIGGLE_PATH =
  "m67.892902,12.746785c43.231313,-6.717223 107.352741,6.609823 121.028973,58.746408c13.676233,52.136585 -44.848649,161.467192 -45.07116,204.650732c4.566246,56.959708 83.805481,87.929227 22.329944,105.806022c-61.475536,17.876795 -126.122496,-1.855045 -143.73294,-41.933823c-17.610444,-40.07878 49.274638,-120.109409 46.14822,-188.091997c-3.126418,-67.982588 -21.873669,-70.257464 -49.613153,-80.177084c-27.739485,-9.919618 5.678801,-52.283035 48.910115,-59.000258z";

/** A filled squiggle, size px wide and twice as tall. Extra props go to the <svg>. */
export default function SquiggleIcon({
  size = 24,
  color = "currentColor",
  ...props
}) {
  return (
    <svg
      width={size}
      height={2 * size}
      viewBox="0 0 200 400"
      aria-hidden="true"
      {...props}
    >
      <path d={SQUIGGLE_PATH} fill={color} stroke={color} strokeWidth={18} />
    </svg>
  );
}
