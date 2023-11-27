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
	isTranscoding,
	isUploading,
} from '../selectors';
import { ItemStatus, type QueueItem } from '../types';

describe( 'selectors', () => {
	describe( 'getItems', () => {
		it( 'should return empty array by default', () => {
			const state = {
				queue: [],
				mediaSourceTerms: {},
				imageSizes: {},
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
				imageSizes: {},
			};

			expect( getItems( state, ItemStatus.Uploading ) ).toHaveLength( 2 );
		} );
	} );

	describe( 'getPendingItems', () => {
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
				imageSizes: {},
			};

			expect( getPendingItems( state ) ).toHaveLength( 1 );
		} );
	} );
	describe( 'getPendingTranscodingItems', () => {
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
			const state = {
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
				imageSizes: {},
			};

			expect( getApprovedItems( state ) ).toHaveLength( 1 );
		} );
	} );
	describe( 'getUploadedItems', () => {
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
				imageSizes: {},
			};

			expect( getUploadedItems( state ) ).toHaveLength( 1 );
		} );
	} );
	describe( 'getCancelledItems', () => {
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
			const state = {
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
			const state = {
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
			const state = {
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
} );
