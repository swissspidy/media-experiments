/**
 * Internal dependencies
 */
import { getItems } from '../selectors';
import { ItemStatus, type QueueItem } from '../types';

describe( 'selectors', () => {
	describe( 'getItems', () => {
		it( 'should return empty array by default', () => {
			const state = {
				queue: [],
				mediaSourceTerms: {},
			};

			expect( getItems( state ) ).toHaveLength( 0 );
		} );

		it( 'should return items with the given status', () => {
			const state = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
			};

			expect( getItems( state, ItemStatus.Uploading ) ).toHaveLength( 2 );
		} );
	} );
} );
