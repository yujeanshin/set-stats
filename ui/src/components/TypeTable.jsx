// One table of set types (brief-v2 part 2): Picks, Expected, Ratio with its
// interval bar, Take rate when present (optional) and Median find time (n).
// Sortable by every column; with groups, rows are sorted within each group
// so the grouping stays. Rows with Expected under MIN_EXPECTED are greyed,
// with the reason in a tooltip. Optionally, hovering a row previews it in
// that tooltip and clicking expands it in place, right under the row.
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
import { Fragment, useState } from "react";
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

function Row({
  row,
  first,
  takeRate,
  preview,
  expandable,
  expanded,
  onToggle,
  renderExpanded,
  rowId,
  nCols,
}) {
  const muted = row.lowData;
  const open = expanded === row.key;
  // One tooltip per row: the preview (until the row is open, when it would
  // repeat what is shown), then the low-data note.
  const tip = [
    expandable && !open ? preview?.(row) : null,
    muted ? DEFINITIONS.lowData : null,
  ].filter(Boolean);
  const cells = (
    <TableRow
      id={rowId?.(row)}
      hover={expandable}
      selected={open}
      onClick={expandable ? () => onToggle(open ? null : row.key) : undefined}
      sx={{
        cursor: expandable ? "pointer" : "default",
        scrollMarginTop: 16,
        "& td": {
          color: muted ? "text.secondary" : "text.primary",
          ...(open ? { borderBottom: 0 } : {}),
        },
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: colors.scale[0] },
      }}
    >
      <TableCell sx={{ py: 0.5 }}>{first.render(row, open)}</TableCell>
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
  return (
    <>
      {tip.length ? (
        <Tooltip
          title={
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tip.map((t, i) => (
                <Fragment key={i}>{t}</Fragment>
              ))}
            </Box>
          }
          followCursor
          placement="bottom-start"
          enterDelay={150}
          enterNextDelay={50}
          describeChild
        >
          {cells}
        </Tooltip>
      ) : (
        cells
      )}
      {open ? (
        <TableRow
          sx={{
            bgcolor: colors.scale[0],
            "&:hover": { bgcolor: colors.scale[0] },
          }}
        >
          <TableCell colSpan={nCols} sx={{ pt: 0.5, pb: 2 }}>
            {renderExpanded(row)}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/**
 * rows: from /api/types, each with a key. first: the first column, as
 * { label, render(row, selected), info? }; it sorts in the given order.
 * groups: optional [{ key, label }], with group(row) naming a row's group.
 * takeRate: show that column. Expandable rows: expanded (a key or null),
 * onToggle(key | null), renderExpanded(row) for the row under it, and
 * optionally preview(row) for the hover tooltip and rowId(row) for an id.
 */
export default function TypeTable({
  rows,
  first,
  groups,
  group,
  takeRate = true,
  expanded = null,
  onToggle,
  renderExpanded,
  preview,
  rowId,
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
  const rowProps = {
    first,
    takeRate,
    preview,
    expandable: !!onToggle,
    expanded,
    onToggle,
    renderExpanded,
    rowId,
    nCols: columns.length + 1,
  };
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
