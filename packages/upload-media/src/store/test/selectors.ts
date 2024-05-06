/**
 * Internal dependencies
 */
import {
	getApprovedItems,
	getCancelledItems,
	getInProgressItems,
	getItems,
	getPendingItems,
	getPendingTranscodingItems,
	getTranscodedItems,
	getUploadedItems,
	isPendingApproval,
	isPendingApprovalByAttachmentId,
	isTranscoding,
	isUploading,
	isUploadingByBatchId,
	isUploadingById,
	isUploadingByUrl,
} from '../selectors';
import { ItemStatus, type QueueItem, type State } from '../types';

describe( 'selectors', () => {
	describe( 'getItems', () => {
		it( 'should return empty array by default', () => {
			const state: State = {
				queue: [],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( getItems( state ) ).toHaveLength( 0 );
		} );

		it( 'should return items with the given status', () => {
			const state: State = {
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
				imageSizes: {},
			};

			expect( getItems( state, ItemStatus.Uploading ) ).toHaveLength( 2 );
		} );
	} );

	describe( 'getPendingItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
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
				imageSizes: {},
			};

			expect( getPendingItems( state ) ).toHaveLength( 1 );
		} );
	} );

	describe( 'getPendingTranscodingItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Uploaded,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( getPendingTranscodingItems( state ) ).toHaveLength( 2 );
		} );
	} );

	describe( 'getTranscodedItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Transcoded,
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
				imageSizes: {},
			};

			expect( getTranscodedItems( state ) ).toHaveLength( 1 );
		} );
	} );

	describe( 'getApprovedItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
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
				imageSizes: {},
			};

			expect( getApprovedItems( state ) ).toHaveLength( 1 );
		} );
	} );

	describe( 'getUploadedItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
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
				imageSizes: {},
			};

			expect( getUploadedItems( state ) ).toHaveLength( 1 );
		} );
	} );

	describe( 'getCancelledItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
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
						status: ItemStatus.Cancelled,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( getCancelledItems( state ) ).toHaveLength( 2 );
		} );
	} );

	describe( 'getInProgressItems', () => {
		it( 'should return items with the given status', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Preparing,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Transcoding,
					},
					{
						status: ItemStatus.Transcoded,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( getInProgressItems( state ) ).toHaveLength( 5 );
		} );
	} );

	describe( 'isTranscoding', () => {
		it( 'should return true if there are items being transcoded', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Preparing,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Transcoding,
					},
					{
						status: ItemStatus.Transcoded,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isTranscoding( state ) ).toBe( true );
		} );
	} );

	describe( 'isUploading', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Preparing,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Transcoding,
					},
					{
						status: ItemStatus.Transcoded,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isUploading( state ) ).toBe( true );
		} );
	} );

	describe( 'isUploadingByUrl', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
						attachment: {
							url: 'https://example.com/one.jpeg',
						},
					},
					{
						status: ItemStatus.Approved,
						sourceUrl: 'https://example.com/two.jpeg',
					},
					{
						status: ItemStatus.Uploading,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect(
				isUploadingByUrl( state, 'https://example.com/one.jpeg' )
			).toBe( true );
			expect(
				isUploadingByUrl( state, 'https://example.com/two.jpeg' )
			).toBe( true );
			expect(
				isUploadingByUrl( state, 'https://example.com/three.jpeg' )
			).toBe( false );
		} );
	} );

	describe( 'isUploadingById', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
						attachment: {
							id: 123,
						},
					},
					{
						status: ItemStatus.Preparing,
						sourceAttachmentId: 456,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isUploadingById( state, 123 ) ).toBe( true );
			expect( isUploadingById( state, 456 ) ).toBe( true );
			expect( isUploadingById( state, 789 ) ).toBe( false );
		} );
	} );

	describe( 'isUploadingByBatchId', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Uploading,
						batchId: 'foo',
					},
					{
						status: ItemStatus.Pending,
						batchId: 'bar',
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isUploadingByBatchId( state, 'foo' ) ).toBe( true );
			expect( isUploadingByBatchId( state, 'bar' ) ).toBe( false );
		} );
	} );

	describe( 'isPendingApproval', () => {
		it( 'should return true if there are items pending approval', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Preparing,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Transcoding,
					},
					{
						status: ItemStatus.Transcoded,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Approved,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isPendingApproval( state ) ).toBe( true );
		} );
	} );

	describe( 'isPendingApprovalByAttachmentId', () => {
		it( 'should return true if there are items pending approval', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Pending,
					},
					{
						status: ItemStatus.Preparing,
					},
					{
						status: ItemStatus.PendingTranscoding,
					},
					{
						status: ItemStatus.Transcoding,
					},
					{
						status: ItemStatus.Transcoded,
					},
					{
						status: ItemStatus.PendingApproval,
						sourceAttachmentId: 123,
					},
					{
						status: ItemStatus.PendingApproval,
						attachment: {
							id: 456,
						},
					},
					{
						status: ItemStatus.Approved,
						sourceAttachmentId: 789,
					},
					{
						status: ItemStatus.Uploading,
					},
					{
						status: ItemStatus.Uploaded,
					},
					{
						status: ItemStatus.Cancelled,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
			};

			expect( isPendingApprovalByAttachmentId( state, 123 ) ).toBe(
				true
			);
			expect( isPendingApprovalByAttachmentId( state, 456 ) ).toBe(
				true
			);
			expect( isPendingApprovalByAttachmentId( state, 786 ) ).toBe(
				false
			);
		} );
	} );
} );
