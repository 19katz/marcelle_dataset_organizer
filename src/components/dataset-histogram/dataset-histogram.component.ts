import type { ChartConfiguration } from 'chart.js';
import colorLib from '@kurkle/color';
import { Component, Dataset, Instance, Stream, ObjectId } from '@marcellejs/core';
import View from './dataset-histogram.view.svelte';

const defaultColors = [
  'rgb(54, 162, 235)',
  'rgb(255, 99, 132)',
  'rgb(255, 206, 86)',
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
  'rgb(255, 159, 64)',
];

export class DatasetHistogram<T extends Instance> extends Component {
  title = 'Dataset Histogram';
  transforms: Transforms<T> = {
    label: (value: T) => value.y,
  };

  $data = new Stream<ChartConfiguration['data']>(undefined, true);
  $hovered: Stream<ObjectId[]> = new Stream([], true);
  $clicked: Stream<ObjectId[]> = new Stream([], true);

  constructor(private dataset: Dataset<T>) {
    super();
    this.dataset.ready.then(() => {
      this.updateData();
    });
  }

  setTransforms(t: Partial<Transforms<T>>) {
    this.transforms = { ...this.transforms, ...t };
    this.updateData();
  }

  async updateData(): Promise<void> {
    await this.dataset.ready;
    const values = await Promise.all(
      await this.dataset
        .items()
        .map(async (instance) => {
          const label = await this.transforms.label(instance);
          return {
            label,
            id: instance.id,
            thumbnail: instance.thumbnail,
          };
        })
        .toArray(),
    );
    const labels = values.map((x) => x.label);
	const uniqueLabels = Array.from(new Set(labels));
	console.log(uniqueLabels);
	uniqueLabels.sort();
	console.log(values);
	let lengths = [];
	for (const label of uniqueLabels) {
		lengths.push(values.filter((v) => v.label === label).length)
	}
    const data: ChartConfiguration['data'] = {
      labels: uniqueLabels,
      datasets: [{
        label: "My graph",
        data: lengths,
        backgroundColor: defaultColors,
      }],
    };
    this.$data.set(data);
  }

  mount(target?: HTMLElement): void {
	const t = target || document.querySelector(`#${this.id}`);
	console.log(t);
    if (!t) return;
    this.destroy();
    this.$$.app = new View({
      target: t,
      props: {
        title: this.title,
        data: this.$data,
        hovered: this.$hovered,
        clicked: this.$clicked,
      },
    });
  }
}