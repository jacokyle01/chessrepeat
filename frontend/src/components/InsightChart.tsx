import React, { useEffect, useMemo, useState } from 'react';
import CalendarHeatmap, { ReactCalendarHeatmapValue } from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import './InsightChart.css';
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

  // With nothing scheduled the grid still draws — every cell just sits at the
  // empty color — so the calendar is always on screen and the "no moves" note
  // goes in the readout strip instead of replacing it.
  const isEmpty = totalMoves === 0;

  return (
    <div className="cr-heatmap">
      <div className="cr-heatmap-grid">
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

      <div className="cr-heatmap-readout">
        {hovered ? (
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
        ) : (
          isEmpty && <span className="cr-heatmap-empty">No moves to chart yet.</span>
        )}
      </div>
    </div>
  );
};

export default InsightChart;
