import React from 'react';
import InsightChart from './InsightChart';
import { CalendarIcon, ChartBarIncreasing } from 'lucide-react';

const Schedule: React.FC = () => {
  return (
    <div className="shrink-0 flex flex-col rounded-lg border border-gray-300 bg-white mb-5 pr-10 mr-auto">
      <div id="schedule-header" className="shrink-0 flex items-center p-3 gap-2">
        <div id="schedule-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <CalendarIcon />
        </div>
        <span className="text-lg text-gray-800 font-semibold">Memory Schedule</span>
      </div>
      <div id="chart-wrap" className="min-h-0 overflow-hidden px-2 pb-3">
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
