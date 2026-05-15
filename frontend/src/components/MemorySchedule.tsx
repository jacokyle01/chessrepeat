import React from 'react';
import InsightChart from './InsightChart';
import { CalendarIcon } from 'lucide-react';

const Schedule: React.FC = () => {
  return (
    <div className="shrink-0 flex flex-col rounded-lg border border-gray-300 bg-white pb-1 w-full">
      <div id="schedule-header" className="shrink-0 flex items-center px-3 pt-2 pb-1 gap-2">
        <div id="schedule-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <CalendarIcon className="w-5 h-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-lg text-gray-800 font-semibold">Memory Schedule</span>
          <span className="-mt-0.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Next 20 weeks
          </span>
        </div>
      </div>

      <div id="chart-wrap" className="px-2 w-full">
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
