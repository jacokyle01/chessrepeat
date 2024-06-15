import { VNode } from 'snabbdom';
import { looseH as h } from './snabbdom';
import { Chart } from 'chart.js/auto';
import PrepCtrl from './ctrl';
import { BarChart, BarData } from './types';

function insightChart(el: HTMLCanvasElement, data: BarData) {
  data = [
    { year: 2010, count: 10 },
    { year: 2011, count: 20 },
    { year: 2012, count: 15 },
    { year: 2013, count: 25 },
    { year: 2014, count: 22 },
    { year: 2015, count: 30 },
    { year: 2016, count: 28 },
  ];
  const config = {
    type: 'bar',
    data: {
      labels: data.map(row => row.year),
      datasets: [
        {
          label: 'Acquisitions by year',
          data: data.map(row => row.count)
        }
      ]
    }
  }

  const chart = new Chart(el, config) as BarChart;
  chart.updateData = (d) => {
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
  const el = vnode.elm as HTMLCanvasElement;
    if (!maybeChart(el)) barchart = insightChart(el, {});
    else if (barchart) barchart.updateData({});
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
