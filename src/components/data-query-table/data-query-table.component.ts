import { Component } from '@marcellejs/core';
import {Dataset, Instance, Stream, ObjectId} from '@marcellejs/core';
import View from './data-query-table.view.svelte';

export interface DBInstance extends Instance {
	y: string;
}
  
interface DatasetBrowserOptions {
		batchSize: number;
}

export class DataQueryTable extends Component {
  title = 'dataset query table';
  
  #dataset: Dataset<DBInstance>;
  $selected: Stream<ObjectId[]> = new Stream([], true);
  $hovered: Stream<ObjectId[]> = new Stream([], true);
  
  batchSize: number;
  
  constructor(
	dataset: Dataset<DBInstance>,
	{ batchSize = 5 }: Partial<DatasetBrowserOptions> = {},
  ) {
	  super();
      this.#dataset = dataset;
	  this.batchSize = batchSize;
	  this.start();
  }
  
  mount(target?: HTMLElement): void {
	const t = target || document.querySelector(`#${this.id}`);
	if (!t) return;
	this.destroy();
	this.$$.app = new View({
	  target: t,
	  props: {
		title: this.title,
		batchSize: this.batchSize,
		count: this.#dataset.$count,
		dataset: this.#dataset,
		selected: this.$selected,
		hovered: this.$hovered
	  },
	});
  }
}
