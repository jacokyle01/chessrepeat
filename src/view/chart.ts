// import { VNode } from 'snabbdom';
// import { looseH as h } from './types/snabbdom';
// import { Chart } from 'chart.js/auto';
// import PrepCtrl from './ctrl';
// import { BarChart, BarData } from './types/types';

// function insightChart(el: HTMLCanvasElement, data: BarData) {
//   // console.log();

//   // data = [
//   //   { year: 2010, count: 10 },
//   //   { year: 2011, count: 20 },
//   //   { year: 2012, count: 15 },
//   //   { year: 2013, count: 25 },
//   //   { year: 2014, count: 22 },
//   //   { year: 2015, count: 30 },
//   //   { year: 2016, count: 28 },
//   // ];
//   const config = {
//     type: 'bar',
//     data: {
//       labels: data.map((_, index) => index + 1), // Creates labels [1, 2, 3, 4]
//       datasets: [
//         {
//           data: data,
//           backgroundColor: ['rgba(75, 192, 192, 0.2)'],
//           borderColor: ['rgba(75, 192, 192, 1)'],
//           borderWidth: 1,
//         },
//       ],
//     },
//     options: {
//       scales: {
//         x: {
//           display: true, // Hides x-axis labels
//         },
//         y: {
//           beginAtZero: true,
//           display: true, // Hides y-axis labels
//         },
//       },
//       plugins: {
//         legend: {
//           display: true, // Hides the legend
//         },
//       },
//     },
//   };

//   const chart = new Chart(el, config) as BarChart;
//   chart.updateData = (d) => {
//     console.log('UPDATING CHART');
//     chart.data = {
//       labels: d.map((_, index) => index + 1), // Creates labels [1, 2, 3, 4]
//       datasets: [
//         {
//           data: d,
//           backgroundColor: ['rgba(75, 192, 192, 0.2)'],
//           borderColor: ['rgba(75, 192, 192, 1)'],
//           borderWidth: 1,
//         },
//       ],
//     };
//     chart.update();
//   };

//   return chart;
// }

// function maybeChart(el: HTMLCanvasElement): Chart | undefined {
//   const ctx = el.getContext('2d');
//   if (ctx) return Chart.getChart(ctx);
//   return undefined;
// }

// let barchart: BarChart;
// function chartHook(vnode: VNode, ctrl: PrepCtrl) {
//   console.log('CHART HOOK');
//   // console.log(ctrl);
//   const subrep = ctrl.chessSrs.state.repertoire[ctrl.chessSrs.state.index];
//   if (!subrep) return;
//   // console.log(subrep);
//   console.log(subrep.meta.bucketEntries);

//   const barData = subrep.meta.bucketEntries;

//   const el = vnode.elm as HTMLCanvasElement;
//   if (!maybeChart(el)) {
//     console.log('NO CHART');
//     barchart = insightChart(el, barData);
//   } else if (barchart) {
//     console.log('YES CHART');
//     barchart.updateData(barData);
//   }
// }

// export const chart = (ctrl: PrepCtrl): VNode => {
//   return h(
//     'div.chart',
//     h('canvas.chart', {
//       hook: {
//         insert: (vnode) => chartHook(vnode, ctrl),
//         update: (_oldVnode, newVnode) => chartHook(newVnode, ctrl),
//       },
//     }),
//   );
// };
