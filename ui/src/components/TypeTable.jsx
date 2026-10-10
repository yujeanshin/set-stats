// One table of set types (brief-v2 part 2): Picks, Expected, Ratio with its
// interval bar, Take rate when present (optional) and Median find time (n).
// Sortable by every column; with groups, rows are sorted within each group
// so the grouping stays. Rows with Expected under MIN_EXPECTED are greyed,
// with the reason in a tooltip.
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import { DEFINITIONS } from "../definitions.js";
import { countText, pctText, ratioText, secs } from "../format.js";
import { colors } from "../theme.js";
import InfoTip from "./InfoTip.jsx";
import RatioBar from "./RatioBar.jsx";

const num = { fontFamily: "mono", fontSize: 14, textAlign: "right" };

const COLUMNS = [
  {
    id: "picks",
    label: "Picks",
    info: DEFINITIONS.picks,
    value: (r) => r.picks,
  },
  {
    id: "expected",
    label: "Expected",
    info: DEFINITIONS.expected,
    value: (r) => r.expected,
  },
  {
    id: "ratio",
    label: "Ratio",
    info: DEFINITIONS.ratio,
    value: (r) => r.ratio,
  },
  {
    id: "takeRate",
    label: "Take rate when present",
    info: DEFINITIONS.takeRate,
    value: (r) => r.takeRate,
  },
  {
    id: "medianMs",
    label: "Median find time (n)",
    info: DEFINITIONS.typeMedian,
    value: (r) => r.medianMs,
  },
];

/** Compare two rows by `value`, nulls last whichever the direction. */
function compare(value, dir) {
  return (a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null || y == null) return (x == null) - (y == null);
    return dir === "asc" ? x - y : y - x;
  };
}

function Row({ row, first, takeRate, onSelect, selected }) {
  const muted = row.lowData;
  const isSelected = selected === row.key;
  const cells = (
    <TableRow
      hover={!!onSelect}
      selected={isSelected}
      onClick={
        onSelect ? () => onSelect(isSelected ? null : row.key) : undefined
      }
      sx={{
        cursor: onSelect ? "pointer" : "default",
        "& td": { color: muted ? "text.secondary" : "text.primary" },
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: colors.scale[0] },
      }}
    >
      <TableCell sx={{ py: 0.5 }}>{first.render(row, isSelected)}</TableCell>
      <TableCell sx={num}>{countText(row.picks)}</TableCell>
      <TableCell sx={num}>{countText(row.expected, 1)}</TableCell>
      <TableCell sx={{ ...num, whiteSpace: "nowrap" }}>
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
        >
          {ratioText(row.ratio)}
          <RatioBar
            ratio={row.ratio}
            low={row.low}
            high={row.high}
            muted={muted}
          />
        </Box>
      </TableCell>
      {takeRate ? (
        <TableCell sx={num}>{pctText(row.takeRate)}</TableCell>
      ) : null}
      <TableCell sx={{ ...num, whiteSpace: "nowrap" }}>
        {row.medianMs == null ? "–" : `${secs(row.medianMs)} s`}
        <Box component="span" sx={{ color: "text.secondary", ml: 0.75 }}>
          ({countText(row.medianN)})
        </Box>
      </TableCell>
    </TableRow>
  );
  return muted ? (
    <Tooltip title={DEFINITIONS.lowData} placement="top-start" describeChild>
      {cells}
    </Tooltip>
  ) : (
    cells
  );
}

/**
 * rows: from /api/types, each with a key. first: the first column, as
 * { label, render(row, selected), info? }; it sorts in the given order.
 * groups: optional [{ key, label }], with group(row) naming a row's group.
 * takeRate: show that column. onSelect(key | null), selected: clickable rows.
 */
export default function TypeTable({
  rows,
  first,
  groups,
  group,
  takeRate = true,
  onSelect,
  selected,
  label,
}) {
  const [sort, setSort] = useState({ id: "order", dir: "asc" });
  const columns = COLUMNS.filter((c) => takeRate || c.id !== "takeRate");
  const order = new Map(rows.map((r, i) => [r.key, i]));
  const value =
    sort.id === "order"
      ? (r) => order.get(r.key)
      : columns.find((c) => c.id === sort.id).value;
  const sorted = (list) => list.toSorted(compare(value, sort.dir));
  const sortBy = (id) =>
    setSort((s) =>
      s.id === id
        ? { id, dir: s.dir === "asc" ? "desc" : "asc" }
        : { id, dir: id === "order" ? "asc" : "desc" },
    );
  const header = (id, text, info) => (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
      <TableSortLabel
        active={sort.id === id}
        direction={sort.id === id ? sort.dir : "asc"}
        onClick={() => sortBy(id)}
      >
        {text}
      </TableSortLabel>
      {info ? <InfoTip title={info} label={text.toLowerCase()} /> : null}
    </Box>
  );
  const rowProps = { first, takeRate, onSelect, selected };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label={label} sx={{ minWidth: 680 }}>
        <TableHead>
          <TableRow>
            <TableCell>{header("order", first.label, first.info)}</TableCell>
            {columns.map((c) => (
              <TableCell
                key={c.id}
                sx={{ textAlign: "right", whiteSpace: "nowrap" }}
              >
                {header(c.id, c.label, c.info)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {groups
            ? groups.flatMap((g) => [
                <TableRow key={`group-${g.key}`}>
                  <TableCell
                    colSpan={columns.length + 1}
                    sx={{
                      pt: 2,
                      pb: 0.75,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "text.secondary",
                    }}
                  >
                    {g.label}
                  </TableCell>
                </TableRow>,
                ...sorted(rows.filter((r) => group(r) === g.key)).map((r) => (
                  <Row key={r.key} row={r} {...rowProps} />
                )),
              ])
            : sorted(rows).map((r) => (
                <Row key={r.key} row={r} {...rowProps} />
              ))}
        </TableBody>
      </Table>
    </Box>
  );
}
