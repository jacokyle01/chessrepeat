import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { clipboardI } from '../svg/clipboard';

export const copyMe = (ctrl: PrepCtrl, value: string): VNode => {
  return h('div#copyfen.flex.items-center.space-x-2', [
    h(
      'input.truncate.border.border-gray-400.rounded-md.px-2.py-1.w-full.bg-white.text-gray-900.cursor-text',
      {
        attrs: {
          readonly: true,
          spellcheck: false,
          value: `${value}`,
        },
      },
    ),
    h(
      'div#clipboard-wrap.p-2.bg-stone-300.rounded-md.cursor-pointer.transition-all.hover:bg-stone-400.active:scale-90.focus:ring-2.focus:ring-blue-400',
      {
        on: {
          click: () => {
            navigator.clipboard.writeText(value);
          },
        },
      },
      [clipboardI()],
    ),
  ]);
};
