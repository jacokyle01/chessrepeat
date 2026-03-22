import React, { useMemo, useState } from 'react';
import { useTrainerStore } from '../state/state';
import { AlarmCheckIcon } from 'lucide-react';

// ---- constants ----

const DAY_SEC = 86400;
const WEEKS_TO_SHOW = 20;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Color scale — 5 buckets from empty to intense
const COLORS = [
  'var(--heat-0, #dfdfdfff)', // 0 moves
  'var(--heat-1, #c9deffff)', // low
  'var(--heat-2, #91bbffff)', // medium
  'var(--heat-3, #6991ffff)', // high
  'var(--heat-4, #1856ffff)', // very high
];

// ---- helpers ----

/** Bucket each dueTime (seconds-til-due) into a day offset from today (0 = today). */
function bucketByDay(dueTimes: number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const sec of dueTimes) {
    // Overdue or due now → day 0
    const dayOffset = Math.max(0, Math.floor(sec / DAY_SEC));
    map.set(dayOffset, (map.get(dayOffset) ?? 0) + 1);
  }
  return map;
}

/** Pick a color index (0–4) based on count and the max value. */
function colorIndex(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  // quantize into 4 non-zero buckets
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** Get Monday-based day-of-week (0=Mon … 6=Sun) */
function mondayDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ---- types ----

interface CellData {
  dayOffset: number;
  date: Date;
  count: number;
  colorIdx: number;
}

// ---- component ----

const InsightHeatCalendar: React.FC = () => {
  let dueTimes = useTrainerStore((s) => s.dueTimes);
  dueTimes = dueTimes.map((_) => Math.trunc(_ / 1000));
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);

  const { grid, maxCount, dueNow, totalMoves, monthLabels } = useMemo(() => {
    const times = dueTimes ?? [];
    const totalMoves = times.length;
    const byDay = bucketByDay(times);
    const dueNow = byDay.get(0) ?? 0;

    // Find the max daily count for color scaling
    let maxCount = 0;
    byDay.forEach((v) => {
      if (v > maxCount) maxCount = v;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = mondayDow(today);

    // We start the grid on the Monday of the current week
    const gridStartOffset = -todayDow; // day offset for the Monday of this week
    const totalDays = WEEKS_TO_SHOW * 7;

    // Build 2D grid: grid[row=dow][col=week]
    const grid: (CellData | null)[][] = Array.from({ length: 7 }, () => []);
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;

    for (let i = 0; i < totalDays; i++) {
      const dayOffset = gridStartOffset + i;
      const col = Math.floor(i / 7); // week index
      const row = i % 7; // day-of-week index (0=Mon)

      const cellDate = new Date(today.getTime() + dayOffset * DAY_SEC * 1000);

      // Only show today and future (past days in the first partial week get null)
      if (dayOffset < 0) {
        grid[row].push(null);
      } else {
        const count = byDay.get(dayOffset) ?? 0;
        grid[row].push({
          dayOffset,
          date: cellDate,
          count,
          colorIdx: colorIndex(count, maxCount),
        });
      }

      // Month labels on the first row
      if (row === 0) {
        const m = cellDate.getMonth();
        if (m !== lastMonth) {
          monthLabels.push({
            col,
            label: cellDate.toLocaleDateString(undefined, { month: 'short' }),
          });
          lastMonth = m;
        }
      }
    }

    return { grid, maxCount, dueNow, totalMoves, monthLabels };
  }, [dueTimes]);

  if (!dueTimes || totalMoves === 0) {
    return <div style={{ padding: 16, opacity: 0.5 }}>No moves to chart yet.</div>;
  }

  const CELL = 14;
  const GAP = 3;
  const LABEL_W = 32;
  const MONTH_H = 18;
  const gridW = WEEKS_TO_SHOW * (CELL + GAP);
  const gridH = 7 * (CELL + GAP);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 12 }}>
      {/* Summary line */}
      <div className="shrink-0 font-semibold text-gray-600 text-sm px-1 uppercase pb-1">
        {`NEXT ${WEEKS_TO_SHOW} WEEKS`}
      </div>

      {/* Scrollable container for small screens */}
      <div>
        <div style={{ position: 'relative', width: LABEL_W + gridW, minWidth: 'fit-content' }}>
          {/* Month labels */}
          <div style={{ marginLeft: LABEL_W, height: MONTH_H, position: 'relative' }}>
            {monthLabels.map((m, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: m.col * (CELL + GAP),
                  fontSize: 11,
                  opacity: 0.6,
                }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex' }}>
            {/* Day-of-week labels */}
            <div
              style={{
                width: LABEL_W,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: GAP,
              }}
            >
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  style={{
                    height: CELL,
                    lineHeight: `${CELL}px`,
                    fontSize: 10,
                    opacity: 0.5,
                    textAlign: 'right',
                    paddingRight: 6,
                  }}
                >
                  {i % 2 === 0 ? label : ''}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div>
              {grid.map((row, rowIdx) => (
                <div key={rowIdx} style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
                  {row.map((cell, colIdx) => (
                    <div
                      key={colIdx}
                      onMouseEnter={() => cell && setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 2,
                        backgroundColor: cell ? COLORS[cell.colorIdx] : 'transparent',
                        border:
                          cell?.dayOffset === 0
                            ? '1.5px solid rgba(255,255,255,0.5)'
                            : '1px solid rgba(255,255,255,0.05)',
                        cursor: cell ? 'pointer' : 'default',
                        transition: 'transform 0.1s',
                        transform:
                          hoveredCell && cell && hoveredCell.dayOffset === cell.dayOffset
                            ? 'scale(1.3)'
                            : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                opacity: 0.8,
                height: 18,
                paddingLeft: 30
              }}
            >
              <strong>
                {hoveredCell.count} move{hoveredCell.count !== 1 ? 's' : ''}
              </strong>
              {' due '}
              {hoveredCell.dayOffset === 0 ? 'today' : `on ${fmtDate(hoveredCell.date)}`}
            </div>
          )}

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: hoveredCell ? 0 : 24,
              fontSize: 11,
              opacity: 0.5,
            }}
          ></div>
        </div>
      </div>
      <div className="pb-5 flex items-end gap-1">
        <AlarmCheckIcon/>
        <span className='font-semibold'>{dueNow}</span>
        <span className='font-lg text-gray-600'>moves due now</span>
      </div>
    </div>
  );
};

export default InsightHeatCalendar;
