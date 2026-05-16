import React, { useEffect, useMemo, useState } from 'react';
import CalendarHeatmap, { ReactCalendarHeatmapValue } from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { useTrainerStore } from '../store/state';
import { AlarmCheckIcon } from 'lucide-react';

const DAY_MS = 86_400_000;
const WEEKS_TO_SHOW = 20;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bucketByDate(dueTimes: number[], today: Date): Map<string, HeatValue> {
  const map = new Map<string, HeatValue>();
  for (const ms of dueTimes) {
    const dayOffset = Math.max(0, Math.floor(ms / DAY_MS));
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const key = toDateKey(date);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { date, key, count: 1 });
    }
  }
  return map;
}

function colorBucket(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

interface HeatValue {
  date: Date;
  key: string;
  count: number;
}



const InsightChart: React.FC = () => {
  const updateDueCounts = useTrainerStore().updateDueCounts
  const [hovered, setHovered] = useState<HeatValue | null>(null);
  useEffect(() => {
    updateDueCounts()
    console.log("hi")
  }, [])
  const dueTimes = useTrainerStore((s) => s.dueTimes);

  const { values, startDate, endDate, maxCount, totalMoves, dueNow, todayKey } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toDateKey(today);

    const totalMoves = dueTimes?.length ?? 0;
    const byDate = bucketByDate(dueTimes ?? [], today);

    let max = 0;
    byDate.forEach((v) => {
      if (v.count > max) max = v.count;
    });

    const dueNow = byDate.get(todayKey)?.count ?? 0;
    const end = new Date(today);
    end.setDate(end.getDate() + WEEKS_TO_SHOW * 7 - 1);

    const vals: HeatValue[] = [];
    byDate.forEach((v) => vals.push(v));

    return { values: vals, startDate: today, endDate: end, maxCount: max, totalMoves, dueNow, todayKey };
  }, [dueTimes]);

  if (!dueTimes || totalMoves === 0) {
    return <div className="px-2 py-1 text-xs text-gray-400">No moves to chart yet.</div>;
  }

  return (
    <div className="cr-heatmap font-sans text-xs w-full">
      <div className="w-full pr-5 -ml-1.5">
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={values}
          showWeekdayLabels
          gutterSize={2}
          classForValue={(v) => {
            const value = v as HeatValue | null;
            const base = !value || !value.count
              ? 'color-cr-0'
              : `color-cr-${colorBucket(value.count, maxCount)}`;
            return value?.key === todayKey ? `${base} cr-today` : base;
          }}
          onMouseOver={(_e, value: ReactCalendarHeatmapValue<Date> | undefined) => {
            if (value && (value as HeatValue).key) {
              setHovered(value as HeatValue);
            }
          }}
          onMouseLeave={() => setHovered(null)}
        />
      </div>

      <div className="h-4 text-[11px] text-gray-700 pl-1 -mt-3">
        {hovered && (
          <>
            <strong>
              {hovered.count} move{hovered.count !== 1 ? 's' : ''}
            </strong>
            {' due '}
            {hovered.key === todayKey
              ? 'today'
              : `on ${hovered.date.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}`}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 pl-1 pt-1 text-[13px]">
        <AlarmCheckIcon className="w-4 h-4 text-gray-700" />
        <span className="font-semibold text-gray-800">{dueNow}</span>
        <span className="text-gray-600">moves due now</span>
      </div>

      <style>{`
        .cr-heatmap .react-calendar-heatmap text { fill: #374151; font-size: 9px; font-weight: 600; }
        .cr-heatmap .react-calendar-heatmap .react-calendar-heatmap-small-text { font-size: 8px; }
        .cr-heatmap .react-calendar-heatmap-month-label { transform: translateY(3px); }
        .cr-heatmap .react-calendar-heatmap-weekday-label { transform: translateX(5px); }
        .cr-heatmap .react-calendar-heatmap rect { rx: 1; ry: 1; }
        .cr-heatmap .react-calendar-heatmap rect.color-cr-0 { fill: #dfdfdf; }
        .cr-heatmap .react-calendar-heatmap rect.color-cr-1 { fill: #c9deff; }
        .cr-heatmap .react-calendar-heatmap rect.color-cr-2 { fill: #91bbff; }
        .cr-heatmap .react-calendar-heatmap rect.color-cr-3 { fill: #6991ff; }
        .cr-heatmap .react-calendar-heatmap rect.color-cr-4 { fill: #1856ff; }
        .cr-heatmap .react-calendar-heatmap rect.cr-today { stroke: #3b82f6; stroke-width: 1.5; }
        .cr-heatmap .react-calendar-heatmap rect:hover { stroke: #555; stroke-width: 1; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default InsightChart;
