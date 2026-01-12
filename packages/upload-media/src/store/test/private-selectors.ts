/**
 * Internal dependencies
 */
import {
	getActiveProcessingCount,
	getConcurrencyLimit,
} from '../private-selectors';
import {
	ItemStatus,
	OperationType,
	type QueueItem,
	type State,
} from '../types';

describe( 'private-selectors', () => {
	describe( 'getActiveProcessingCount', () => {
		it( 'returns 0 when no items are processing', () => {
			const state: State = {
				concurrencyLimit: 4,
				queue: [],
				queueStatus: 'active',
				pendingApproval: undefined,
				blobUrls: {},
				settings: {
					mediaUpload: jest.fn(),
					mediaSideload: jest.fn(),
					imageSizes: {},
				},
			};

			expect( getActiveProcessingCount( state ) ).toBe( 0 );
		} );

		it( 'returns count of items with currentOperation set', () => {
			const state: State = {
				concurrencyLimit: 4,
				queue: [
					{
						id: '1',
						status: ItemStatus.Processing,
						currentOperation: OperationType.Compress,
					} as QueueItem,
					{
						id: '2',
						status: ItemStatus.Processing,
						currentOperation: OperationType.TranscodeVideo,
					} as QueueItem,
					{
						id: '3',
						status: ItemStatus.Processing,
					} as QueueItem,
					{
						id: '4',
						status: ItemStatus.Paused,
						currentOperation: OperationType.Compress,
					} as QueueItem,
				],
				queueStatus: 'active',
				pendingApproval: undefined,
				blobUrls: {},
				settings: {
					mediaUpload: jest.fn(),
					mediaSideload: jest.fn(),
					imageSizes: {},
				},
			};

			expect( getActiveProcessingCount( state ) ).toBe( 2 );
		} );
	} );

	describe( 'getConcurrencyLimit', () => {
		it( 'returns the configured concurrency limit', () => {
			const state: State = {
				concurrencyLimit: 6,
				queue: [],
				queueStatus: 'active',
				pendingApproval: undefined,
				blobUrls: {},
				settings: {
					mediaUpload: jest.fn(),
					mediaSideload: jest.fn(),
					imageSizes: {},
				},
			};

			expect( getConcurrencyLimit( state ) ).toBe( 6 );
		} );
	} );
} );
