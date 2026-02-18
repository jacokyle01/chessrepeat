import React from 'react';
import InsightChart from './InsightChart';
import { CalendarIcon } from 'lucide-react';

const Schedule: React.FC = () => {
  return (
    <div className="shrink-0 flex flex-col rounded-lg border border-gray-300 bg-white mb-5 mr-auto w-full">
      <div id="schedule-header" className="shrink-0 flex items-center p-3 gap-2">
        <div id="schedule-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <CalendarIcon className="w-5 h-5" />
        </div>
        <span className="text-lg text-gray-800 font-semibold">Memory Schedule</span>
      </div>

      {/* Reserve consistent space for the chart/empty state */}
      <div
        id="chart-wrap"
        className="
          px-2 pb-3
          overflow-hidden
          h-[180px]   /* <- tune this once */
        "
      >
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
