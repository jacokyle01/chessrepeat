import {
  init,
  eventListenersModule,
  propsModule,
  attributesModule,
  classModule,
  styleModule,
} from 'snabbdom';
import PrepCtrl from './ctrl';
import view from './view/view';

const patch = init([eventListenersModule, propsModule, attributesModule, classModule, styleModule]);

const ctrl = new PrepCtrl(redraw);
const element = document.querySelector('body')!;
element.innerHTML = '';
const inner = document.createElement('div');
element.appendChild(inner);
let vnode = patch(inner, view(ctrl));

function redraw() {
  vnode = patch(vnode, view(ctrl));
}

ctrl.init();