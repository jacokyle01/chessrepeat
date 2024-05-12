import { VNode, h } from "snabbdom";
import PrepCtrl from "./ctrl";
import { chessground } from "./chessground";

const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
	return h("div#add-subrepertoire-wrap", [
		h("h2", "add subrepertoire"),
		h("textarea"),
		h("button", {
			on: {
				click: () => {
					const pgn = document.querySelector("textarea")!;
          ctrl.addSubrepertoire(pgn.value)
				},
			},
		}),
	]);
};

const view = (ctrl: PrepCtrl): VNode => {
	return h("div#main", [
		h("button#clicker", { on: { click: () => ctrl.increment() } }),
		h("div#count", ctrl.count),
		h("div", chessground(ctrl)),
		addSubrepertoire(ctrl),
	]);
};
export default view;
