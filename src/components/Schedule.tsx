import React from "react";
import InsightChart from "./InsightChart";

const Schedule: React.FC = () => {
  return (
    <div className="flex flex-col bg-white bg-clip-border text-gray-700 shadow-md rounded-md border border-gray-200 pb-5">
      <span className="text-xl font-bold py-2 pl-2 border-b-2 mb-2 border-gray-300">
        Memory Schedule
      </span>
      <span className="font-semibold text-gray-600 px-1">Due at</span>
      <div id="chart-wrap" className="px-1">
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
