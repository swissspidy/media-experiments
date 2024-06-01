import reducer from '../reducer';
import { ItemStatus, type QueueItem, Type } from '../types';

describe( 'reducer', () => {
	describe( `${ Type.Remove }`, () => {
		it( 'removes an item from the queue', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
					} as QueueItem,
					{
						id: '2',
						status: ItemStatus.Processing,
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.Remove,
				id: '1',
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '2',
						status: ItemStatus.Processing,
					},
				],
			} );
		} );
	} );
} );
