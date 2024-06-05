import reducer from '../reducer';
import {
	ItemStatus,
	OperationType,
	Type,
	type MediaSourceTerm,
	type QueueItem,
} from '../types';

describe( 'reducer', () => {
	describe( `${ Type.Add }`, () => {
		it( 'adds an item to the queue', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.Add,
				item: {
					id: '2',
					status: ItemStatus.Processing,
				} as QueueItem,
			} );

			expect( state ).toEqual( {
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
					},
				],
			} );
		} );
	} );

	describe( `${ Type.Cancel }`, () => {
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
				type: Type.Cancel,
				id: '2',
				error: new Error(),
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
					},
					{
						id: '2',
						status: ItemStatus.Processing,
						error: expect.any( Error ),
					},
				],
			} );
		} );
	} );

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

	describe( `${ Type.Pause }`, () => {
		it( 'marks an item as paused', () => {
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
				type: Type.Pause,
				id: '2',
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
					},
					{
						id: '2',
						status: ItemStatus.Paused,
					},
				],
			} );
		} );
	} );

	describe( `${ Type.Resume }`, () => {
		it( 'marks an item as processing', () => {
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
						status: ItemStatus.Paused,
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.Resume,
				id: '2',
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
					},
					{
						id: '2',
						status: ItemStatus.Processing,
					},
				],
			} );
		} );
	} );

	describe( `${ Type.AddOperations }`, () => {
		it( 'prepends operations to the list', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
						operations: [ OperationType.Upload ],
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.AddOperations,
				id: '1',
				operations: [
					OperationType.TranscodeCompress,
					OperationType.AddPoster,
				],
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
						operations: [
							OperationType.TranscodeCompress,
							OperationType.AddPoster,
							OperationType.Upload,
						],
					},
				],
			} );
		} );
	} );

	describe( `${ Type.OperationStart }`, () => {
		it( 'marks an item as processing', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
						operations: [
							OperationType.AddPoster,
							OperationType.Upload,
						],
					} as QueueItem,
					{
						id: '2',
						status: ItemStatus.Processing,
						operations: [
							OperationType.AddPoster,
							OperationType.Upload,
						],
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.OperationStart,
				id: '2',
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
						operations: [
							OperationType.AddPoster,
							OperationType.Upload,
						],
					},
					{
						id: '2',
						status: ItemStatus.Processing,
						operations: [
							OperationType.AddPoster,
							OperationType.Upload,
						],
						currentOperation: OperationType.AddPoster,
					},
				],
			} );
		} );
	} );

	describe( `${ Type.OperationFinish }`, () => {
		it( 'marks an item as processing', () => {
			const initialState = {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						additionalData: {},
						attachment: {},
						mediaSourceTerms: [] as MediaSourceTerm[],
						status: ItemStatus.Processing,
						operations: [
							OperationType.AddPoster,
							OperationType.Upload,
						],
						currentOperation: OperationType.AddPoster,
					} as QueueItem,
				],
			};
			const state = reducer( initialState, {
				type: Type.OperationFinish,
				id: '1',
				item: {},
			} );

			expect( state ).toEqual( {
				mediaSourceTerms: {},
				imageSizes: {},
				queue: [
					{
						id: '1',
						additionalData: {},
						attachment: {},
						mediaSourceTerms: [] as MediaSourceTerm[],
						status: ItemStatus.Processing,
						currentOperation: null,
						operations: [ OperationType.Upload ],
					},
				],
			} );
		} );
	} );
} );
