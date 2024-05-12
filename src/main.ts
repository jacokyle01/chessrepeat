import { init, eventListenersModule, propsModule, attributesModule, classModule } from 'snabbdom';
import PrepCtrl from './ctrl';
import view from './view';

const patch = init([eventListenersModule, propsModule, attributesModule, classModule]);

const ctrl = new PrepCtrl(redraw);
const element = document.getElementById('app')!;
element.innerHTML = '';
const inner = document.createElement('div');
element.appendChild(inner);
let vnode = patch(inner, view(ctrl));

function redraw() {
  vnode = patch(vnode, view(ctrl));
}
