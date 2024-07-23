import {
	type BatchId,
	type ImageSizeCrop,
	ItemStatus,
	OperationType,
	type QueueItem,
	type QueueItemId,
	type Settings,
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
export function getItems( state: State, status?: ItemStatus ): QueueItem[] {
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
export function getItem(
	state: State,
	id: QueueItemId
): QueueItem | undefined {
	return state.queue.find( ( item ) => item.id === id );
}

/**
 * Determines whether there is an item pending approval.
 *
 * @param state Upload state.
 *
 * @return Whether there is an item pending approval.
 */
export function isPendingApproval( state: State ): boolean {
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
export function getItemByAttachmentId(
	state: State,
	attachmentId: number
): QueueItem | undefined {
	return state.queue.find(
		( item ) =>
			item.attachment?.id === attachmentId ||
			item.sourceAttachmentId === attachmentId
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
): boolean {
	const foundItem = state.queue.find(
		( item ) => item.status === ItemStatus.PendingApproval
	);

	if ( ! foundItem ) {
		return false;
	}

	return (
		foundItem.attachment?.id === attachmentId ||
		foundItem.sourceAttachmentId === attachmentId
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
): {
	oldUrl: string | undefined;
	oldSize: number;
	newSize: number;
	newUrl: string | undefined;
	sizeDiff: number;
} | null {
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
export function isBatchUploaded( state: State, batchId: BatchId ): boolean {
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
export function isUploading( state: State ): boolean {
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
export function isUploadingByUrl( state: State, url: string ): boolean {
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
export function isUploadingById( state: State, attachmentId: number ): boolean {
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
export function isUploadingToPost(
	state: State,
	postOrAttachmentId: number
): boolean {
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
): QueueItem | undefined {
	return state.queue.find(
		( item ) =>
			item.status === ItemStatus.Paused &&
			item.additionalData.post === postOrAttachmentId
	);
}

/**
 * Determines whether an upload is currently in progress given a parent ID.
 *
 * @param state    Upload state.
 * @param parentId Parent ID.
 *
 * @return Whether upload is currently in progress for the given parent ID.
 */
export function isUploadingByParentId(
	state: State,
	parentId: QueueItemId
): boolean {
	return state.queue.some( ( item ) => item.parentId === parentId );
}

/**
 * Determines whether uploading is currently paused.
 *
 * @param state Upload state.
 *
 * @return Whether uploading is currently paused.
 */
export function isPaused( state: State ): boolean {
	return state.queueStatus === 'paused';
}

/**
 * Returns an image size given its name.
 *
 * @param state Upload state.
 * @param name  Image size name.
 *
 * @return Image size data.
 */
export function getImageSize( state: State, name: string ): ImageSizeCrop {
	return state.imageSizes[ name ];
}

/**
 * Returns all cached blob URLs for a given item ID.
 *
 * @param state Upload state.
 * @param id    Item ID
 *
 * @return List of blob URLs.
 */
export function getBlobUrls( state: State, id: QueueItemId ): string[] {
	return state.blobUrls[ id ] || [];
}

/**
 * Returns the media upload settings.
 *
 * @param state Upload state.
 *
 * @return Settings
 */
export function getSettings( state: State ): Settings {
	return state.settings;
}
