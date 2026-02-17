// // import React, { useMemo } from 'react';
// // import {
// //   Chart as ChartJS,
// //   LineElement,
// //   PointElement,
// //   LinearScale,
// //   Tooltip,
// //   Legend,
// //   ChartData,
// //   ChartOptions,
// // } from 'chart.js';
// // import { Line } from 'react-chartjs-2';
// // import ChartDataLabels from 'chartjs-plugin-datalabels';
// // import { useTrainerStore } from '../state/state';

// // ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, ChartDataLabels);

// // // ---- helpers ----

// // const DAY = 24 * 60 * 60 * 1000;

// // function startOfDayMs(t: number) {
// //   const d = new Date(t);
// //   d.setHours(0, 0, 0, 0);
// //   return d.getTime();
// // }

// // function fmtShortDate(t: number) {
// //   return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
// // }

// // /**
// //  * Build a cumulative "% due by time t" series.
// //  * - dueTimes: array of epoch ms when each move becomes due
// //  * - horizonDays: how far to plot into the future
// //  * - stepDays: sampling resolution (1 = daily)
// //  * - includeOverdueAtStart: if true, overdue contributes at the first point (now)
// //  */
// // function buildCumulativeDueSeries(
// //   dueTimes: number[],
// //   { now = Date.now(), horizonDays = 60, stepDays = 1, includeOverdueAtStart = true } = {},
// // ) {
// //   const total = dueTimes.length;
// //   if (total === 0) return { total: 0, points: [] as { x: number; y: number }[] };

// //   const sorted = [...dueTimes].sort((a, b) => a - b);

// //   const start = startOfDayMs(now);
// //   const end = start + horizonDays * DAY;
// //   const stepMs = stepDays * DAY;

// //   // Count due by "now"
// //   const dueByNow = includeOverdueAtStart
// //     ? upperBound(sorted, now) // <= now
// //     : 0;

// //   const points: { x: number; y: number }[] = [];
// //   points.push({ x: now, y: (dueByNow / total) * 100 });

// //   // March forward (monotonic cumulative)
// //   for (let t = start; t <= end; t += stepMs) {
// //     const dueByT = upperBound(sorted, t);
// //     points.push({ x: t, y: (dueByT / total) * 100 });
// //   }

// //   return { total, points };
// // }

// // // first index i where arr[i] > x  (so count of <= x is i)
// // function upperBound(arr: number[], x: number) {
// //   let lo = 0;
// //   let hi = arr.length;
// //   while (lo < hi) {
// //     const mid = (lo + hi) >>> 1;
// //     if (arr[mid] <= x) lo = mid + 1;
// //     else hi = mid;
// //   }
// //   return lo;
// // }

// // const InsightChart: React.FC = () => {
// //   let dueTimes = useTrainerStore((s) => s.dueTimes);
// //   if (!dueTimes) return;
// //   dueTimes = dueTimes.map((dueTime) => Math.trunc(dueTime / 1000));
// //   console.log('DT', dueTimes);

// //   const { points, total } = useMemo(
// //     () =>
// //       buildCumulativeDueSeries(dueTimes, {
// //         horizonDays: 60,
// //         stepDays: 1,
// //         includeOverdueAtStart: true,
// //       }),
// //     [dueTimes],
// //   );

// //   console.log('points, total', points, total);

// //   const data: ChartData<'line', { x: number; y: number }[]> = useMemo(
// //     () => ({
// //       datasets: [
// //         {
// //           label: total ? `% due (cumulative) — ${total} moves` : '% due (cumulative)',
// //           data: points,
// //           parsing: false, // because we provide {x,y}
// //           borderWidth: 2,
// //           pointRadius: 0,
// //           tension: 0.25, // “flowing”
// //         },
// //       ],
// //     }),
// //     [points, total],
// //   );

// //   const options: ChartOptions<'line'> = useMemo(
// //     () => ({
// //       responsive: true,
// //       maintainAspectRatio: false,
// //       animation: false,
// //       plugins: {
// //         legend: { display: false },
// //         tooltip: {
// //           mode: 'index',
// //           intersect: false,
// //           callbacks: {
// //             title: (items) => {
// //               const x = items?.[0]?.parsed?.x;
// //               if (!x) return '';
// //               return fmtShortDate(x);
// //             },
// //             label: (ctx) => `${ctx.parsed.y.toFixed(1)}% due by then`,
// //           },
// //         },
// //         datalabels: { display: false }, // usually too noisy on a line
// //       },
// //       interaction: { mode: 'index', intersect: false },
// //       scales: {
// //         // NOTE: this uses a numeric x-axis in epoch ms to avoid needing Chart.js time adapter
// //         x: {
// //           type: 'linear',
// //           grid: { display: false },
// //           ticks: {
// //             maxTicksLimit: 10,
// //             callback: (value) => fmtShortDate(Number(value)),
// //           },
// //         },
// //         y: {
// //           beginAtZero: true,
// //           max: 100,
// //           ticks: {
// //             callback: (v) => `${v}%`,
// //           },
// //         },
// //       },
// //     }),
// //     [],
// //   );

// //   return <Line data={data} options={options} />;
// // };

// // export default InsightChart;

// // // import React from 'react';
// // // import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ChartData, ChartOptions } from 'chart.js';
// // // import { Bar } from 'react-chartjs-2';
// // // import ChartDataLabels from 'chartjs-plugin-datalabels';
// // // import { formatTime } from '../util/time';
// // // import { useTrainerStore } from '../state/state';

// // // ChartJS.register(BarElement, CategoryScale, LinearScale, ChartDataLabels);

// // // const InsightChart: React.FC = () => {
// // //   // const labels = ['now', ...ctrl.trainingConfig!.buckets!.map((x) => `≤ ${formatTime(x)}`)];
// // //   const labels = [
// // //     'now',
// // //     ...useTrainerStore.getState().trainingConfig.buckets.map((x) => `≤ ${formatTime(x)}`),
// // //   ];
// // //   // const barData = ctrl.dueTimes;
// // //   const barData = useTrainerStore.getState().dueTimes;

// // //   const data: ChartData<'bar'> = {
// // //     labels,
// // //     datasets: [
// // //       {
// // //         data: barData,
// // //         backgroundColor: [
// // //           'rgba(255, 99, 132, 0.2)',
// // //           'rgba(255, 159, 64, 0.2)',
// // //           'rgba(255, 205, 86, 0.2)',
// // //           'rgba(75, 192, 192, 0.2)',
// // //           'rgba(54, 162, 235, 0.2)',
// // //           'rgba(153, 102, 255, 0.2)',
// // //           'rgba(201, 203, 207, 0.2)',
// // //         ],
// // //         borderColor: 'gray',
// // //         borderWidth: 1,
// // //       },
// // //     ],
// // //   };

// // //   const options: ChartOptions<'bar'> = {
// // //     responsive: true,
// // //     maintainAspectRatio: false,
// // //     indexAxis: 'y',
// // //     animation: false,
// // //     plugins: {
// // //       legend: { display: false },
// // //       datalabels: {
// // //         color: 'black',
// // //         font: { size: 14 },
// // //         formatter: (value: number) => (value === 0 ? '' : `${value}`),
// // //         textAlign: 'center',
// // //       },
// // //     },
// // //     scales: {
// // //       x: {
// // //         ticks: { display: false },
// // //         grid: { display: false },
// // //       },
// // //       y: {
// // //         grid: { display: true },
// // //         ticks: {
// // //           autoSkip: false, // 👈 show every label
// // //           maxRotation: 0,
// // //           minRotation: 0,
// // //           // optional: make them smaller so they fit
// // //           font: { size: 10 },
// // //         },
// // //       },
// // //     },
// // //   };

// // //   return <Bar data={data} options={options} />;
// // // };

// // // export default InsightChart;

// import React, { useMemo } from 'react';
// import {
//   Chart as ChartJS,
//   LineElement,
//   PointElement,
//   LinearScale,
//   Tooltip,
//   Legend,
//   Filler,
// } from 'chart.js';
// import { Line } from 'react-chartjs-2';
// import type { ChartData, ChartOptions } from 'chart.js';
// import { useTrainerStore } from '../state/state';

// ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

// const HOUR = 3600;
// const DAY = 86400;

// /** Format seconds-from-now into a readable label */
// function fmtDuration(seconds: number): string {
//   if (seconds <= 0) return 'Now';
//   if (seconds < HOUR) return `${Math.round(seconds / 60)}m`;
//   if (seconds < DAY) return `${Math.round(seconds / HOUR)}h`;
//   return `${Math.round(seconds / DAY)}d`;
// }

// /**
//  * Build cumulative "% of moves due by time t" series.
//  *
//  * dueTimes: seconds until due per move. <=0 means overdue/due now.
//  * horizonDays: how far into the future to plot.
//  * steps: number of sample points on the x-axis.
//  */
// function buildCumulativeSeries(
//   dueTimes: number[],
//   horizonDays = 60,
//   steps = 120,
// ) {
//   const total = dueTimes.length;
//   if (total === 0)
//     return { total: 0, dueNow: 0, points: [] as { x: number; y: number }[] };

//   const sorted = [...dueTimes].sort((a, b) => a - b);
//   const horizonSec = horizonDays * DAY;
//   const stepSec = horizonSec / steps;

//   // Moves with seconds <= 0 are due now
//   const dueNow = upperBound(sorted, 0);

//   const points: { x: number; y: number }[] = [];
//   points.push({ x: 0, y: (dueNow / total) * 100 });

//   for (let i = 1; i <= steps; i++) {
//     const t = i * stepSec;
//     const dueByT = upperBound(sorted, t);
//     points.push({ x: t, y: (dueByT / total) * 100 });
//   }

//   return { total, dueNow, points };
// }

// /** Count of elements in sorted arr that are <= x */
// function upperBound(arr: number[], x: number): number {
//   let lo = 0;
//   let hi = arr.length;
//   while (lo < hi) {
//     const mid = (lo + hi) >>> 1;
//     if (arr[mid] <= x) lo = mid + 1;
//     else hi = mid;
//   }
//   return lo;
// }

// const InsightChart: React.FC = () => {
//   const dueTimes = useTrainerStore((s) => s.dueTimes);

//   const { points, total, dueNow } = useMemo(
//     () => buildCumulativeSeries(dueTimes ?? [], 60, 120),
//     [dueTimes],
//   );

//   if (!dueTimes || total === 0) {
//     return (
//       <div style={{ padding: 16, opacity: 0.5 }}>No moves to chart yet.</div>
//     );
//   }

//   const data: ChartData<'line', { x: number; y: number }[]> = {
//     datasets: [
//       {
//         label: `Cumulative % due — ${total} moves`,
//         data: points,
//         parsing: false,
//         borderColor: 'rgba(54, 162, 235, 1)',
//         backgroundColor: 'rgba(54, 162, 235, 0.1)',
//         fill: true,
//         borderWidth: 2,
//         pointRadius: 0,
//         tension: 0.3,
//       },
//     ],
//   };

//   const options: ChartOptions<'line'> = {
//     responsive: true,
//     maintainAspectRatio: false,
//     animation: false,
//     plugins: {
//       legend: { display: false },
//       tooltip: {
//         mode: 'index',
//         intersect: false,
//         callbacks: {
//           title: (items) => {
//             const x = items?.[0]?.parsed?.x;
//             if (x == null) return '';
//             return fmtDuration(x);
//           },
//           label: (ctx) => {
//             const pct = ctx.parsed.y.toFixed(1);
//             const count = Math.round((ctx.parsed.y / 100) * total);
//             return `${pct}% due (${count} of ${total} moves)`;
//           },
//         },
//       },
//     },
//     interaction: { mode: 'index', intersect: false },
//     scales: {
//       x: {
//         type: 'linear',
//         title: { display: true, text: 'Time from now' },
//         grid: { display: false },
//         ticks: {
//           maxTicksLimit: 10,
//           callback: (value) => fmtDuration(Number(value)),
//         },
//       },
//       y: {
//         beginAtZero: true,
//         max: 100,
//         title: { display: true, text: '% of moves due' },
//         ticks: {
//           callback: (v) => `${v}%`,
//         },
//       },
//     },
//   };

//   return (
//     <div>
//       <div style={{ fontSize: 13, marginBottom: 4, opacity: 0.7 }}>
//         {dueNow} of {total} moves due now (
//         {((dueNow / total) * 100).toFixed(0)}%)
//       </div>
//       <div style={{ position: 'relative', height: 260 }}>
//         <Line data={data} options={options} />
//       </div>
//     </div>
//   );
// };

// export default InsightChart;

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
      <div className="shrink-0 font-semibold text-gray-600 text-sm px-1 uppercase pb-2">
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
      <div className="mb-2 flex items-end gap-1">
        <AlarmCheckIcon/>
        <span className='font-semibold'>{dueNow}</span>
        <span className='font-lg text-gray-600'>moves due now</span>
      </div>
    </div>
  );
};

export default InsightHeatCalendar;
