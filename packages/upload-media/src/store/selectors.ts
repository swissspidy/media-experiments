/**
 * Internal dependencies
 */
import { ItemStatus, type QueueItem, type Settings, type State } from './types';

/**
 * Returns all items currently being uploaded, without sub-sizes (children).
 *
 * @param state Upload state.
 *
 * @return Queue items.
 */
export function getItems( state: State ): QueueItem[] {
	return state.queue.filter( ( item ) => ! item.parentId );
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
 * Determines whether an item is the first one pending approval given its associated attachment ID.
 *
 * @param state        Upload state.
 * @param attachmentId Attachment ID.
 *
 * @return Whether the item is first in the list of items pending approval.
 */
export function isPendingApprovalByAttachmentId(
	state: State,
	attachmentId: number
): boolean {
	if ( ! state.pendingApproval ) {
		return false;
	}

	return state.queue.some(
		( item ) =>
			item.status === ItemStatus.PendingApproval &&
			item.id === state.pendingApproval &&
			( item.attachment?.id === attachmentId ||
				item.sourceAttachmentId === attachmentId )
	);
}

/**
 * Returns data to compare the old file vs. the optimized file, given the attachment ID.
 *
 * Includes both the URLs and the respective file sizes and the size difference in percentage.
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
	currentQuality: number;
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

	// Use the actual quality used during optimization if available.
	// Fallback to 80 (the default in optimizeImageItem) if not present.
	const currentQuality =
		typeof foundItem.quality === 'number' ? foundItem.quality : 80;

	return {
		oldUrl: foundItem.sourceUrl,
		oldSize: foundItem.sourceFile.size,
		newSize: foundItem.file.size,
		newUrl: foundItem.attachment?.url,
		sizeDiff: foundItem.file.size / foundItem.sourceFile.size - 1,
		currentQuality,
	};
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
 * Returns the media upload settings.
 *
 * @param state Upload state.
 *
 * @return Settings
 */
export function getSettings( state: State ): Settings {
	return state.settings;
}
