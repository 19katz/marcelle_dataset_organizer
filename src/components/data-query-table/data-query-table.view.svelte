<svelte:options accessors />

<script lang="ts">
  import type { ObjectId, Stream, Dataset } from '@marcellejs/core';
  import type { DBInstance } from './data-query-table.component';
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { scale } from 'svelte/transition';
  import { ViewContainer } from '@marcellejs/design-system';
  import { Button, PopMenu } from '@marcellejs/design-system';
  import { identity } from 'svelte/internal';
  export let title: string;
  export let batchSize: number;
  export let count: Stream<number>;
  export let dataset: Dataset<DBInstance>;
  export let selected: Stream<ObjectId[]>;
  export let hovered: Stream<ObjectId[]>;
  let loading = false;
  let dataStoreError = false;
  let classes: Record<
    string,
    {
      total: number;
      loaded: number;
      instances: Partial<DBInstance>[];
    }
  > = {};
  let num_relabeled = 0;
  let num_total = 0;
  async function loadMore(label: string) {
    await dataset.ready;
    for await (const instance of dataset
      .items()
      .query({ y: label, $sort: { updatedAt: -1 } })
      .skip(classes[label].loaded)
      .take(batchSize)
      .select(['id', 'y', 'thumbnail'])) {
      classes[label].instances = [...classes[label].instances, instance];
      classes[label].loaded += 1;
      num_total += 1;
    }
  }
  async function updateClassesFromDataset() {
    if (loading) return;
    loading = true;
    try {
      dataStoreError = false;
      await dataset.ready;
    } catch (e) {
      loading = false;
      dataStoreError = true;
      return;
    }
    const labels = await dataset.distinct('y');
    classes = labels.reduce(
      (x, lab) => ({
        ...x,
        [lab]: {
          total: 0,
          loaded: 0,
          instances: [],
        },
      }),
      {},
    );
    for (const label of labels) {
      const { total } = await dataset.find({ query: { $limit: 0, y: label } });
      classes[label].total = total;
      console.log(total);
      if (batchSize > 0) {
        await loadMore(label);
      } else {
        while (classes[label].loaded < classes[label].total) {
          await loadMore(label);
        }
      }
    }
    loading = false;
  }
  function getLabel(id: ObjectId) {
    for (const [label, { instances }] of Object.entries(classes)) {
      if (instances.map((x) => x.id).includes(id)) {
        return label;
      }
    }
    return null;
  }
  async function deleteSelectedInstances() {
    let p: Promise<unknown> = Promise.resolve();
    for (const id of selected.get()) {
      // eslint-disable-next-line no-loop-func
      p = p.then(() => dataset.remove(id));
    }
    await p;
    selected.set([]);
    setIdThumbnail();
  }

  async function remove(id: ObjectId) {
    let p: Promise<unknown> = Promise.resolve();
    
    p = p.then(() => dataset.remove(id));

    await p;
    selected.set(selected.get().filter((x) => x !== id));
    setIdThumbnail();
  };

  async function relabelSelectedInstances(newLabel: string) {
    let p: Promise<unknown> = Promise.resolve();
    for (const id of selected.get()) {
      // eslint-disable-next-line no-loop-func
      p = p.then(() => dataset.patch(id, { y: newLabel }));
      num_relabeled += 1;
    }
    await p;
    
    selected.set([]);
    setIdThumbnail();
  }
  async function relabelOneInstance(id: string, newLabel: string) {
    let p: Promise<unknown> = Promise.resolve();
    p = p.then(() => dataset.patch(id, { y: newLabel }));
    num_relabeled += 1;
    await p;

    selected.set(selected.get().filter((x) => x !== id));
    setIdThumbnail();
  }

  let metaPressed = false;
  let shiftPressed = false;
  function handleKeydown(event: KeyboardEvent) {
    if (['Meta', 'Control'].includes(event.key)) {
      metaPressed = true;
    } else if (event.key === 'Shift') {
      shiftPressed = true;
    } else if (event.key === 'Delete' || (event.key === 'Backspace' && metaPressed)) {
      deleteSelectedInstances();
    }
  }
  function handleKeyup(event: KeyboardEvent) {
    if (['Meta', 'Control'].includes(event.key)) {
      metaPressed = false;
    } else if (event.key === 'Shift') {
      shiftPressed = false;
    }
  }
  let initialId: ObjectId = null;
  let currentSelectedInd = 0;
  let currentSelectedId = "";
  let currentSelectedImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  let currentSelectedLabel = "";
  let newLabel = "";
  function selectInstance(id?: ObjectId, hover?: Boolean) {
    if (hover) {
      hovered.set(id ? [id] : []);
    }
    else {
      if (metaPressed) {
        if (!id) return;
        if (selected.get().includes(id)) {
          selected.set(selected.get().filter((x) => x !== id));
        } else {
          selected.set(selected.get().concat([id]));
        }
      } else if (shiftPressed) {
        if (!initialId || !id) return;
        const srcLabel = getLabel(initialId);
        const dstLabel = getLabel(id);
        if (srcLabel !== dstLabel) return;
        const instances = classes[srcLabel].instances.map((x) => x.id);
        const srcIndex = instances.indexOf(initialId);
        const dstIndex = instances.indexOf(id);
        selected.set(
          srcIndex < dstIndex
            ? instances.slice(srcIndex, dstIndex + 1)
            : instances.slice(dstIndex, srcIndex + 1),
        );
      } else {
        if (id) {
          if (selected.get().includes(id)) {

            selected.set(selected.get().filter((x) => x != id));
            if (currentSelectedInd <= 0) {
              currentSelectedInd = 0;
            }
            else if (currentSelectedInd > selected.get().length - 1) {
              currentSelectedInd = selected.get().length - 1;
            }
          }
          else {
            selected.set(selected.get().concat([id]));
          }
          setIdThumbnail();
        }
        initialId = id;
      }
    }
  }

  function clearSelection() {
    selected.set([]);
    setIdThumbnail();
  }

  function setIdThumbnail() {
    if (selected.get().length > 0) {
      currentSelectedId = selected.get()[currentSelectedInd];
      for (const [label, { instances }] of Object.entries(classes)) {
        for (const {thumbnail, id} of instances) {
          if (id == currentSelectedId)  {
            currentSelectedImg = thumbnail;
            currentSelectedLabel = label;
          }
        }
      }
    }
    else {
      currentSelectedImg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
      currentSelectedLabel = "";
    }
  }

  function selectAllInstances() {
    for (const [label, { instances }] of Object.entries(classes)) {
      for (const {id} of instances) {
        selectInstance(id, false);
      }
    }
  }

  const prevCard = () => {
		if (currentSelectedInd == 0) {
			currentSelectedInd = selected.get().length - 1;
		} else {
			currentSelectedInd -= 1;
    }
    setIdThumbnail();
	}
	
	const nextCard = () => {
		if (currentSelectedInd === selected.get().length - 1) {
			currentSelectedInd = 0;
		} else {
			currentSelectedInd += 1;
    }	
    setIdThumbnail();
	}

  function onClassAction(label: string, code: string) {
    let result: string;
    switch (code) {
      case 'edit':
        // eslint-disable-next-line no-alert
        result = window.prompt('Enter the new class name', label);
        if (result) {
          dataset.patch(null, { y: result }, { query: { y: label } });
        }
        break;
      case 'delete':
        dataset.remove(null, { query: { y: label } });
        break;
      case 'deleteInstances':
        deleteSelectedInstances();
        break;
      case 'relabelInstances':
        // eslint-disable-next-line no-alert
        result = window.prompt('Enter the new label', label);
        if (result) {
          relabelSelectedInstances(result);
        }
        break;
      default:
        // eslint-disable-next-line no-alert
        alert(`Class ${label}: ${code}`);
        break;
    }
  }
  onMount(() => {
    updateClassesFromDataset();
    dataset.$changes.subscribe(async (changes) => {
      for (const { level, type, data } of changes) {
        if (level === 'dataset') {
          if (type === 'created') {
            selectInstance();
            updateClassesFromDataset();
          }
        } else if (level === 'instance') {
          if (type === 'created') {
            if (!classes[data.y]) {
              classes[data.y] = {
                total: 0,
                loaded: 0,
                instances: [],
              };
            }
            classes[data.y].total += 1;
            classes[data.y].loaded += 1;
            classes[data.y].instances = [
              { id: data.id, y: data.y, thumbnail: data.thumbnail },
              ...classes[data.y].instances,
            ];
          } else if (type === 'updated') {
            // TODO: what if the image is not displayed?
            const originalLabel = getLabel(data.id);
            classes[originalLabel].total -= 1;
            classes[originalLabel].loaded -= 1;
            classes[originalLabel].instances = classes[originalLabel].instances.filter(
              ({ id }) => id !== data.id,
            );
            if (classes[originalLabel].total === 0) {
              delete classes[originalLabel];
              classes = classes;
            }
            if (!classes[data.y]) {
              classes[data.y] = {
                total: 0,
                loaded: 0,
                instances: [],
              };
            }
            classes[data.y].instances = [
              { id: data.id, y: data.y, thumbnail: data.thumbnail },
              ...classes[data.y].instances,
            ];
          } else if (type === 'removed') {
            classes[data.y].total -= 1;
            classes[data.y].loaded -= 1;
            classes[data.y].instances = classes[data.y].instances.filter(
              ({ id }) => id !== data.id,
            );
            if (classes[data.y].total === 0) {
              delete classes[data.y];
              classes = classes;
            }
          }
        }
      }
    });
  });
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} />

<ViewContainer {title} {loading}>
  {#if classes && !dataStoreError}
    {#if $count > 0}
      <p class="ml-3 mt-2">This dataset contains {$count} instance{$count > 1 ? 's' : ''}. {num_relabeled}
        point{num_relabeled > 1 || num_relabeled == 0 ? 's' : ''} {num_relabeled > 1 || num_relabeled == 0 ? 'have' : 'has'} been relabeled out of {$count} total.</p>
    {:else}
      <p class="ml-3 mt-2">This dataset is empty.</p>
    {/if}
    <div class="browser-class-head">
      <Button size="large" variant="light" on:click={selectAllInstances}>Select all</Button>
      <Button size="large" variant="light" on:click={clearSelection}>Clear all selections</Button>
      <Button size="large" type="danger" variant="light" on:click={deleteSelectedInstances}>Delete all selections</Button>
      {#if $selected.length >= 0}
        <h3 style="text-align:center">Selected Datapoints</h3>
        <p style="text-align:center">Scroll through points you have selected.</p>
        <p style="text-align:center">Current label: {currentSelectedLabel}</p>
        <img
          src={currentSelectedImg}
          alt="thumbnail"
          class="m-1"
          in:scale
          out:scale
        />
        <Button size="small" variant="light" on:click={() => prevCard()}>
          Previous
        </Button>

        <input type="text" placeholder="New label" bind:value={newLabel} />
        <Button size="small" variant = "outline" on:click={() => relabelOneInstance(currentSelectedId, newLabel)}>Relabel</Button>
        <Button size="small" type="danger" variant = "outline" on:click={() => remove(currentSelectedId)}>Delete</Button>
        <Button size="small" variant="light" on:click={() => nextCard()}>
          Next
        </Button>
      {/if}
    </div>

    <div class="flex flex-wrap" on:click={() => selectInstance()}>
      {#each Object.entries(classes) as [label, { loaded, total, instances }]}
        <div class="browser-class">
          <div class="w-full">
            <div class="browser-class-header">
              <span class="browser-class-title">{label}</span>
              <div style="margin: 0.5rem"><Button  size="small" variant="outline" on:click={() => onClassAction(label, "edit")}>
            Edit Name
          </Button>
          <Button size="small" type="danger" variant="outline" on:click={() => onClassAction(label, "delete")}>
            X
          </Button></div>
            </div>
            <div class="browser-class-body">
              {#each instances as { id, thumbnail } (id)}
                <img
                  src={thumbnail}
                  alt="thumbnail"
                  class="m-1"
                  class:selected={$selected.includes(id)}
                  class:hover={$hovered.includes(id) && !$selected.includes(id)}
                  in:scale
                  out:scale
                  on:click|stopPropagation={() => selectInstance(id)}
                  on:mouseover|stopPropagation={() => selectInstance(id, true)}
                />
                <span style="top: -50px" on:pointerdown={e => e.stopPropagation()}
                  on:click={() => remove(id)}
                  class="remove"
                  >
                  ✕
                </span>
              {/each}
            </div>
          </div>
          <div class="pb-1">
            {#if loaded < total}
              <Button size="small" variant="light" on:click={() => loadMore(label)}>
                View More
              </Button>
            {/if}
          </div>
          
        </div>
      {/each}
    </div>
  {/if}
  {#if dataStoreError}
    <div
      class="flex p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800"
      role="alert"
    >
      <svg
        class="inline flex-shrink-0 mr-3 w-5 h-5"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        ><path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        /></svg
      >
      <div>
        <span class="font-medium">Data Store connection Error!</span> This data store probably requires
        authentication
      </div>
    </div>
  {/if}
</ViewContainer>

<style>
  .browser-class {
    --tw-border-opacity: 1;
    align-items: center;
    border-color: rgb(107 114 128/var(--tw-border-opacity));
    border-radius: 0.5rem;
    border-style: solid;
    border-width: 2px;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    justify-content: space-between;
    margin: 1rem;
    margin-bottom: 4rem;
    min-width: 300px;
    position: relative;
    width: 33.333333%;
  }

  .browser-class-header {
    
    align-items: center;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }

  .browser-class-title {
    --tw-bg-opacity: 1;
    --tw-text-opacity: 1;
    align-self: flex-start;
    background-color: rgb(107 114 128/var(--tw-bg-opacity));
    border-bottom-right-radius: 0.375rem;
    border-top-left-radius: 0.375rem;
    color: rgb(255 255 255/var(--tw-text-opacity));
    font-size: .875rem;
    font-weight: 600;
    line-height: 1.25rem;
    padding: 0.25rem 0.5rem;
  }

  .browser-class-body {
    align-items: center;
    display: block;
  }

  .browser-class-head {
    display: block;
    margin-left: auto;
    margin-right: auto;
    padding: 1.0rem 1.0rem;
  }

  .browser-class-body img {
    width: 50px;
    box-sizing: content-box;
  }
  .browser-class-head img {
    width: 200px;
    box-sizing: content-box;
    align-items: center;
    display: block;
    margin-left: auto;
    margin-right: auto;
    border-color: rgb(74 160 44/var(--tw-border-opacity));
    border-radius: 0.5rem;
    border-style: solid;
  }

  .square {
    height: 200px;
    width: 200px;
    border-color: rgb(74 160 44/var(--tw-border-opacity));
    border-radius: 0.5rem;
    border-style: solid;
  }

  .browser-class-body .remove { 
    cursor: pointer;
    position: relative;
    user-select: none;
  }

  .browser-class-body img.selected {
    --tw-border-opacity: 1;
    border-color: rgb(74 160 44/var(--tw-border-opacity));
    border-radius: 0.5rem;
    border-style: solid;
  }
  .browser-class-body img.hover {
    --tw-border-opacity: 0.8;
    border-color: rgb(255 216 1/var(--tw-border-opacity));
    border-radius: 0.5rem;
    border-style: solid;
  }

</style>