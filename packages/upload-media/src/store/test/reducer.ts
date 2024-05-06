import reducer from '../reducer';
import { ItemStatus, type QueueItem, Type } from '../types';

describe( 'reducer', () => {
	describe( `${ Type.Prepare }`, () => {
		it( 'marks an item as preparing', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Pending,
					} as QueueItem,
					{
						id: '2',
						status: ItemStatus.Pending,
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.Prepare,
				id: '1',
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Preparing,
					},
					{
						id: '2',
						status: ItemStatus.Pending,
					},
				],
			} );
		} );
	} );
} );
