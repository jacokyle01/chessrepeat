import { Redraw } from "./types";

export default class PrepCtrl {
	count = 0;

	constructor(readonly redraw: Redraw) {}

	increment = () => {
		this.count++;
    this.redraw();
	};
}
