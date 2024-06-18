import {
	type BatchId,
	ItemStatus,
	type MediaSourceTerm,
	OperationType,
	type QueueItemId,
	type State,
} from './types';

/**
 * Returns all items currently being uploaded.
 *
 * @param state  Upload state.
 * @param status Status to filter items by.
 *
 * @return Queue items.
 */
export function getItems( state: State, status?: ItemStatus ) {
	if ( status ) {
		return state.queue.filter( ( item ) => item.status === status );
	}

	return state.queue;
}

/**
 * Returns a specific item given its unique ID.
 *
 * @param state Upload state.
 * @param id    Item ID.
 *
 * @return Queue item.
 */
export function getItem( state: State, id: QueueItemId ) {
	return state.queue.find( ( item ) => item.id === id );
}

/**
 * Determines whether there is an item pending approval.
 *
 * @param state Upload state.
 *
 * @return Whether there is an item pending approval.
 */
export function isPendingApproval( state: State ) {
	return state.queue.some(
		( item ) => item.status === ItemStatus.PendingApproval
	);
}

/**
 * Returns a specific item given its associated attachment ID.
 *
 * @param state        Upload state.
 * @param attachmentId Item ID.
 *
 * @return Queue item.
 */
export function getItemByAttachmentId( state: State, attachmentId: number ) {
	return state.queue.find(
		( item ) =>
			item.attachment?.id === attachmentId ||
			item.sourceAttachmentId === attachmentId
	);
}

/**
 * Determines whether there is an item pending approval given its associated attachment ID.
 *
 * @param state        Upload state.
 * @param attachmentId Attachment ID.
 *
 * @return Whether the item is pending approval.
 */
export function isPendingApprovalByAttachmentId(
	state: State,
	attachmentId: number
) {
	return state.queue.some(
		( item ) =>
			( item.attachment?.id === attachmentId ||
				item.sourceAttachmentId === attachmentId ) &&
			item.status === ItemStatus.PendingApproval
	);
}

/**
 * Determines whether an item is the first one pending approval given its associated attachment ID.
 *
 * @param state        Upload state.
 * @param attachmentId Attachment ID.
 *
 * @return Whether the item is first in the list of items pending approval.
 */
export function isFirstPendingApprovalByAttachmentId(
	state: State,
	attachmentId: number
) {
	const foundItem = state.queue.find(
		( item ) => item.status === ItemStatus.PendingApproval
	);

	return (
		foundItem &&
		( foundItem.attachment?.id === attachmentId ||
			foundItem.sourceAttachmentId === attachmentId )
	);
}

/**
 * Returns data to compare the old file vs. the optimized file, given the attachment ID.
 *
 * Includes both the URLs as well as the respective file sizes and the size difference in percentage.
 *
 * @param state        Upload state.
 * @param attachmentId Attachment ID.
 *
 * @return Comparison data.
 */
export function getComparisonDataForApproval(
	state: State,
	attachmentId: number
) {
	const foundItem = state.queue.find(
		( item ) =>
			( item.attachment?.id === attachmentId ||
				item.sourceAttachmentId === attachmentId ) &&
			item.status === ItemStatus.PendingApproval
	);

	if ( ! foundItem ) {
		return null;
	}

	return {
		oldUrl: foundItem.sourceUrl,
		oldSize: foundItem.sourceFile.size,
		newSize: foundItem.file.size,
		newUrl: foundItem.attachment?.url,
		sizeDiff: foundItem.file.size / foundItem.sourceFile.size - 1,
	};
}

/**
 * Determines whether a batch has been successfully uploaded, given its unique ID.
 *
 * @param state   Upload state.
 * @param batchId Batch ID.
 *
 * @return Whether a batch has been uploaded.
 */
export function isBatchUploaded( state: State, batchId: BatchId ) {
	const batchItems = state.queue.filter(
		( item ) => batchId === item.batchId
	);
	return batchItems.length <= 1;
}

/**
 * Determines whether any upload is currently in progress.
 *
 * @todo Change forceIsSaving in GB depending on this selector.
 * @see https://github.com/WordPress/gutenberg/blob/a889ec84318fe5ee9ee76f1226b30283b27c99a7/packages/edit-post/src/components/header/index.js#L35
 *
 * @param state Upload state.
 *
 * @return Whether any upload is currently in progress.
 */
export function isUploading( state: State ) {
	return state.queue.length >= 1;
}

/**
 * Determines whether an upload is currently in progress given an attachment URL.
 *
 * @param state Upload state.
 * @param url   Attachment URL.
 *
 * @return Whether upload is currently in progress for the given attachment.
 */
export function isUploadingByUrl( state: State, url: string ) {
	return state.queue.some(
		( item ) => item.attachment?.url === url || item.sourceUrl === url
	);
}

/**
 * Determines whether an upload is currently in progress given an attachment ID.
 *
 * @param state        Upload state.
 * @param attachmentId Attachment ID.
 *
 * @return Whether upload is currently in progress for the given attachment.
 */
export function isUploadingById( state: State, attachmentId: number ) {
	return state.queue.some(
		( item ) =>
			item.attachment?.id === attachmentId ||
			item.sourceAttachmentId === attachmentId
	);
}

/**
 * Determines whether an upload is currently in progress given a post or attachment ID.
 *
 * @param state              Upload state.
 * @param postOrAttachmentId Post ID or attachment ID.
 *
 * @return Whether upload is currently in progress for the given post or attachment.
 */
export function isUploadingToPost( state: State, postOrAttachmentId: number ) {
	return state.queue.some(
		( item ) =>
			item.currentOperation === OperationType.Upload &&
			item.additionalData.post === postOrAttachmentId
	);
}

/**
 * Returns the next paused upload for a given post or attachment ID.
 *
 * @param state              Upload state.
 * @param postOrAttachmentId Post ID or attachment ID.
 *
 * @return Paused item.
 */
export function getPausedUploadForPost(
	state: State,
	postOrAttachmentId: number
) {
	return state.queue.find(
		( item ) =>
			item.status === ItemStatus.Paused &&
			item.additionalData.post === postOrAttachmentId
	);
}

/**
 * Determines whether an upload is currently in progress given a batch ID.
 *
 * @param state   Upload state.
 * @param batchId Batch ID.
 *
 * @return Whether upload is currently in progress for the given batch ID.
 */
export function isUploadingByBatchId( state: State, batchId: BatchId ) {
	return state.queue.some( ( item ) => item.batchId === batchId );
}

/**
 * Determines whether uploading is currently paused.
 *
 * @param state Upload state.
 *
 * @return Whether uploading is currently paused.
 */
export function isPaused( state: State ) {
	return state.queueStatus === 'paused';
}

/**
 * Returns a media source term ID given its slug.
 *
 * @param state Upload state.
 * @param slug  Term slug.
 *
 * @return Term ID.
 */
export function getMediaSourceTermId( state: State, slug: MediaSourceTerm ) {
	return state.mediaSourceTerms[ slug ];
}

/**
 * Returns an image size given its name.
 *
 * @param state Upload state.
 * @param name  Image size name.
 *
 * @return Image size data.
 */
export function getImageSize( state: State, name: string ) {
	return state.imageSizes[ name ];
}
