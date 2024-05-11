import { VNode, h } from "snabbdom";
import PrepCtrl from "./ctrl";

const view = (ctrl: PrepCtrl): VNode => {
	return h("div#main", [
		h("button#clicker", { on: { click: () => ctrl.increment() } }),
		h("div#count", ctrl.count),
	]);
};
export default view;
