import React from 'react';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatTime } from '../util/time'
import { useTrainerStore } from '../state/state';

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartDataLabels);

const InsightChart: React.FC = () => {
  // const labels = ['now', ...ctrl.srsConfig!.buckets!.map((x) => `≤ ${formatTime(x)}`)];
  const labels = ['now', ...useTrainerStore.getState().srsConfig.buckets.map((x) => `≤ ${formatTime(x)}`)];
  // const barData = ctrl.dueTimes;
  const barData = useTrainerStore.getState().dueTimes;

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: barData,
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(255, 159, 64, 0.2)',
          'rgba(255, 205, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(201, 203, 207, 0.2)',
        ],
        borderColor: 'gray',
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
