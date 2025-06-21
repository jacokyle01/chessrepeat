import React from 'react';
import InsightChart from './InsightChart';
import { ChartBarIncreasing } from 'lucide-react';

const Schedule: React.FC = () => {
  return (
    <div className="flex flex-col rounded-2xl border border-gray-300 bg-white pb-5">
      <span id="schedule-header" className="flex flex-row items-center justify-left p-3 gap-2">
        <div id="schedule-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <ChartBarIncreasing></ChartBarIncreasing>
        </div>
        <span className="text-xl text-gray-800 font-semibold">Memory Schedule</span>
      </span>
      <span className="font-semibold text-gray-600 text-sm px-1 uppercase pl-4">Due at</span>
      <div id="chart-wrap" className="px-1">
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
