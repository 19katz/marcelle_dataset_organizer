<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { Button, ViewContainer } from '@marcellejs/design-system';
  import type { Stream } from '@marcellejs/core';
  import {
    Chart,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    ScatterController,
    Title,
    Tooltip,
    ChartConfiguration,
  } from 'chart.js';

  import type { ObjectId } from '@marcellejs/core';
  import { dequal } from 'dequal';
  Chart.register(
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    ScatterController,
    Title,
    Tooltip,
  );
  export let title: string;
  export let data: Stream<ChartConfiguration['data']>;
  export let hovered: Stream<ObjectId[]>;
  export let clicked: Stream<ObjectId[]>;
  const getOrCreateTooltip = (chart: any) => {
    let tooltipEl = chart.canvas.parentNode.querySelector('div');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.style.background = 'transparent';
      tooltipEl.style.borderRadius = '3px';
      tooltipEl.style.color = 'white';
      tooltipEl.style.opacity = 1;
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.transform = 'translate(-50%, 0)';
      tooltipEl.style.transition = 'all .1s ease';
      const img = document.createElement('img');
      img.style.borderRadius = '4px';
      img.style.margin = '0px';
      img.width = 100;
      img.height = 100;
      tooltipEl.appendChild(img);
      chart.canvas.parentNode.appendChild(tooltipEl);
    }
    return tooltipEl;
  };
  export function externalTooltipHandler(context: any) {
    // Tooltip Element
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);
    // Hide if no tooltip
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = 0;
      return;
    }
    const img = tooltipEl.querySelector('img');
    img.src = tooltip.dataPoints[0].raw.thumbnail;
    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 70 + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 20 + 'px';
    tooltipEl.style.font = tooltip.options.bodyFont.string;
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
  }
  const defaultOptions: Partial<ChartConfiguration> = {
    type: 'bar',
    data: { datasets: [], labels: []},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },

      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          enabled: false,
          position: 'nearest',
          external: externalTooltipHandler,
        },
      },
    },
  };
  let chart: Chart;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let unSub: () => void = () => {};
  let canvasElement: HTMLCanvasElement;
  async function setup() {
    unSub();
    console.log("setting up");
    console.log(data.get());
    const chartOptions: Partial<ChartConfiguration> = { ...defaultOptions, data: data.get() };
    unSub = data
      .filter((x) => !!x)
      .subscribe((d) => {
        chartOptions.data = d;
        chart.update();
      });
    const ctx = canvasElement.getContext('2d');
    chart = new Chart(ctx, chartOptions as ChartConfiguration);
  }

  async function update() {
    unSub();
    chart?.destroy();
    setup();
  }
  onMount(async () => {
    await tick();
    await tick();
    setup();
  });
  onDestroy(() => {
    unSub();
    chart?.destroy();
  });
</script>
<ViewContainer {title}>
  <div id="scatter-container"><canvas bind:this={canvasElement} /></div>
  <Button on:click={update}>Update</Button>
</ViewContainer>
<style>
  #scatter-container {
    height: 400px;
  }
</style>
