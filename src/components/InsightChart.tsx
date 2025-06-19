import React from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatTime } from '../util/time';
import { useTrainerStore } from '../state/state';

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartDataLabels);

const InsightChart: React.FC = () => {
  // const labels = ['now', ...ctrl.srsConfig!.buckets!.map((x) => `≤ ${formatTime(x)}`)];
  const labels = ["now", ...useTrainerStore.getState().srsConfig.buckets.map((x) => `≤ ${formatTime(x)}`)];
  // const barData = ctrl.dueTimes;
  const barData = useTrainerStore.getState().dueTimes;

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: barData,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    animation: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        color: 'black',
        font: { size: 14 },
        formatter: (value: number) => (value === 0 ? '' : `${value}`),
        textAlign: 'center',
      },
    },
    scales: {
      x: {
        ticks: { display: false },
        grid: { display: false },
      },
      y: {
        ticks: { display: true },
        grid: { display: true },
      },
    },
  };

  return <Bar data={data} options={options} />;
};

export default InsightChart;
