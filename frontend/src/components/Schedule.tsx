import React from 'react';
import InsightChart from './InsightChart';
import { ChartBarIncreasing } from 'lucide-react';

const Schedule: React.FC = () => {
  return (
    <div className="shrink-0 flex flex-col rounded-lg border border-gray-300 bg-white mb-5">
      <div id="schedule-header" className="shrink-0 flex items-center p-3 gap-2">
        <div id="schedule-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <ChartBarIncreasing />
        </div>
        <span className="text-lg text-gray-800 font-semibold">Memory Schedule</span>
      </div>

      <div className="shrink-0 font-semibold text-gray-600 text-sm px-1 uppercase pl-4">
        Due at
      </div>

      <div id="chart-wrap" className="flex-1 min-h-0 overflow-hidden px-2 pb-3">
        <InsightChart />
      </div>
    </div>
  );
};


export default Schedule;
