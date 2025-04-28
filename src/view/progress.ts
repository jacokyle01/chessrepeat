import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';

export const progress = (ctrl: PrepCtrl): VNode => {
  let seenCount = 0;
  let totalCount = 1;
  if (ctrl.subrep()) {
    const meta = ctrl.subrep()?.meta;
    seenCount = meta.bucketEntries.reduce((a, b) => a + b, 0);
    totalCount = meta.nodeCount;
  }

    const percentage = Math.round((seenCount / totalCount) * 100);

    return h('div.items-center', {}, [
      // Label and percentage row
      h('div.gap-2.items-center', { class: { flex: true, 'justify-left': true, 'my-0': true } }, [
      ]),

  

    ]);
  };
