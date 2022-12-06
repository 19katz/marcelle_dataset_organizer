import { DataQueryTable } from './data-query-table.component';

export function dataQueryTable(...args: ConstructorParameters<typeof DataQueryTable>): DataQueryTable {
	return new DataQueryTable(...args);
}

export type { DataQueryTable };
