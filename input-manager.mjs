import _ from "lodash";

export class InputManager {
  constructor(listInputs) {
    this.index = 0;
    this.listInputs = listInputs;
  }

  getInput() {
    if (this.index >= this.listInputs.length) return null;
    const input = this.listInputs[this.index++ % this.listInputs.length];
    return input;
  }

  getTotal() {
    return this.listInputs.length;
  }

  unshift(input) {
    this.listInputs.unshift(input);
  }
}
