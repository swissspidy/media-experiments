/**
 * Internal dependencies
 */
import {
	getItems,
	isPendingApproval,
	isPendingApprovalByAttachmentId,
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
				queueStatus: 'paused',
			};

			expect( getItems( state ) ).toHaveLength( 0 );
		} );

		it( 'should return items with the given status', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
			};

			expect( getItems( state, ItemStatus.Processing ) ).toHaveLength(
				3
			);
		} );
	} );

	describe( 'isUploading', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Paused,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
			};

			expect( isUploading( state ) ).toBe( true );
		} );
	} );

	describe( 'isUploadingByUrl', () => {
		it( 'should return true if there are items in the pipeline', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Processing,
						attachment: {
							url: 'https://example.com/one.jpeg',
						},
					},
					{
						status: ItemStatus.PendingApproval,
						sourceUrl: 'https://example.com/two.jpeg',
					},
					{
						status: ItemStatus.Processing,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
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
						status: ItemStatus.Processing,
						attachment: {
							id: 123,
						},
					},
					{
						status: ItemStatus.PendingApproval,
						sourceAttachmentId: 456,
					},
					{
						status: ItemStatus.PendingApproval,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
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
						status: ItemStatus.Processing,
						batchId: 'foo',
					},
					{
						status: ItemStatus.Processing,
						batchId: 'bar',
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
			};

			expect( isUploadingByBatchId( state, 'foo' ) ).toBe( true );
			expect( isUploadingByBatchId( state, 'baz' ) ).toBe( false );
		} );
	} );

	describe( 'isPendingApproval', () => {
		it( 'should return true if there are items pending approval', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Paused,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
					},
					{
						status: ItemStatus.Paused,
					},
					{
						status: ItemStatus.Processing,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
			};

			expect( isPendingApproval( state ) ).toBe( true );
		} );
	} );

	describe( 'isPendingApprovalByAttachmentId', () => {
		it( 'should return true if there are items pending approval', () => {
			const state: State = {
				queue: [
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.Processing,
					},
					{
						status: ItemStatus.PendingApproval,
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
						status: ItemStatus.Paused,
						sourceAttachmentId: 789,
					},
					{
						status: ItemStatus.Processing,
					},
				] as QueueItem[],
				mediaSourceTerms: {},
				imageSizes: {},
				queueStatus: 'paused',
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
