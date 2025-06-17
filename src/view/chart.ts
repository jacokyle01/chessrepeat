import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { Chart } from 'chart.js/auto';
import PrepCtrl from '../ctrl';
import { BarChart, BarData } from '../types/types';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatTime } from '../util/time';

Chart.register(ChartDataLabels);

function insightChart(ctrl: PrepCtrl, el: HTMLCanvasElement, data: BarData) {
  // console.log();

  // data = [
  //   { year: 2010, count: 10 },
  //   { year: 2011, count: 20 },
  //   { year: 2012, count: 15 },
  //   { year: 2013, count: 25 },
  //   { year: 2014, count: 22 },
  //   { year: 2015, count: 30 },
  //   { year: 2016, count: 28 },
  // ];
  // alert(ctrl.srsConfig.buckets);
  const config = {
    type: 'bar',
    data: {
      // labels: ["now", ...ctrl.srsConfig!.buckets!.map((x) => `${x} seconds`)], // Creates labels [1, 2, 3, 4]
      datasets: [
        {
          data: data,
          backgroundColor: ['rgba(75, 192, 192, 0.2)'],
          borderColor: ['rgba(75, 192, 192, 1)'],
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      cutout: 70,
      animation: false, // Disable animations
      plugins: {
        legend: {
          display: false, // Hide the legend
        },
        datalabels: {
          font: {
            size: 14,
          },
          color: 'black',
          formatter: function (value: any) {
            return value === 0 ? '' : `${value}`;
          },
          textAlign: 'center',
          labels: {
            firstLine: {
              font: {
                weight: 'bold', // First line bold
              },
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            display: false, // Hide x-axis labels
          },
          grid: {
            display: false, // Remove x-axis grid lines
          },
        },
        y: {
          ticks: {
            display: true, // Hide y-axis labels (if needed)
          },
          grid: {
            display: true, // Remove y-axis grid lines
          },
        },
      },
    },
  };
  
// @ts-ignore: Suppress the error for this line
  const chart = new Chart(el, config) as BarChart;
  chart.updateData = (d) => {
    // console.log('UPDATING CHART');
    // console.log(d);
    chart.data = {
      labels: ["now", ...ctrl.srsConfig!.buckets!.map((x) => `≤ ${formatTime(x)}`)],
      
      datasets: [
        {
          // @ts-ignore: Suppress the error for this line
          data: d,
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(255, 159, 64, 0.2)',
            'rgba(255, 205, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(201, 203, 207, 0.2)',
          ],
        },
      ],
    };
    chart.update();
  };

  return chart;
}

function maybeChart(el: HTMLCanvasElement): Chart | undefined {
  const ctx = el.getContext('2d');
  if (ctx) return Chart.getChart(ctx);
  return undefined;
}

let barchart: BarChart;
function chartHook(vnode: VNode, ctrl: PrepCtrl) {
  // console.log('CHART HOOK');
  // console.log(ctrl);
  const subrep = ctrl.subrep();
  if (!subrep) return;
  // console.log(subrep);
  // console.log(subrep.meta.bucketEntries);

  // const meta = ctrl.subrep().meta;
  // const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);

  const barData = ctrl.dueTimes;

  const el = vnode.elm as HTMLCanvasElement;
  if (!maybeChart(el)) {
    // console.log('NO CHART');
    barchart = insightChart(ctrl, el, barData);
  } else if (barchart) {
    // console.log('YES CHART');
    barchart.updateData(barData);
  }
}

export const chart = (ctrl: PrepCtrl): VNode => {
  return h(
    'div.chart',
    h('canvas.chart', {
      hook: {
        insert: (vnode) => chartHook(vnode, ctrl),
        update: (_oldVnode, newVnode) => chartHook(newVnode, ctrl),
      },
    }),
  );
};
