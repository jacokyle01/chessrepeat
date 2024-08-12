import PrepCtrl from "../ctrl";
import { ToastType } from "../types/types";
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { crossI } from "../svg/cross";
import { infoI } from "../svg/info";
import { questionI } from "../svg/question";


export const toast = (ctrl: PrepCtrl): VNode | null => {
  const getIcon = (type: ToastType): VNode => {
    switch (type) {
      case 'fail':
        return crossI(ctrl);
      case 'learn':
        return infoI();
      case 'recall':
        return questionI();
    }
  };

  return (
    ctrl.toastMessage &&
    h('div.p-1', [
      h('div.w-50.shadow-lg.rounded-lg.flex', [
        h(
          'div.bg-blue-500.py-3.px-3.rounded-l-lg.flex.items-center',
          {
            class: {
              'bg-blue-500': ctrl.toastMessage.type === 'learn',
              'bg-orange-500': ctrl.toastMessage.type === 'recall',
              'bg-red-500': ctrl.toastMessage.type === 'fail',
            },
          },
          // [ctrl.toastMessage.type === 'learn' ? infoI() : questionI()],
          getIcon(ctrl.toastMessage.type),
        ),
        h(
          'div.px-4.py-2.bg-white.rounded-r-lg.flex.justify-between.items-center.w-full.border.border-l.transparent.border-gray-200',
          [h('div.font-light.text-sm', ctrl.toastMessage.message)],
        ),
      ]),
    ])
  );
};