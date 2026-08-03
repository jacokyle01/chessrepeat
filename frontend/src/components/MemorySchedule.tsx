import React from 'react';
import InsightChart from './InsightChart';
import { CalendarIcon, CircleHelp } from 'lucide-react';
import './MemorySchedule.css';

const Schedule: React.FC = () => {
  return (
    <div className="schedule-card">
      <div id="schedule-header" className="panel-header">
        <div id="schedule-icon-wrap" className="panel-icon">
          <CalendarIcon />
        </div>
        <div className="panel-titles">
          <span className="panel-title">Memory Schedule</span>
          <span className="panel-subtitle">Next 20 weeks</span>
        </div>

        <a
          href="https://github.com/jacokyle01/chessrepeat#spaced-repetition-in-chessrepeat"
          target="_blank"
          rel="noopener noreferrer"
          title="Learn how the memory schedule works"
          aria-label="Learn how the memory schedule works"
          className="schedule-help"
        >
          <CircleHelp />
        </a>
      </div>

      <div id="chart-wrap" className="schedule-chart-wrap">
        <InsightChart />
      </div>
    </div>
  );
};

export default Schedule;
