import {
	ItemStatus,
	OperationType,
	type BatchId,
	type MediaSourceTerm,
	type QueueItemId,
	type State,
} from './types';

export function getItems( state: State, status?: ItemStatus ) {
	if ( status ) {
		return state.queue.filter( ( item ) => item.status === status );
	}

	return state.queue;
}

export function getItem( state: State, id: QueueItemId ) {
	return state.queue.find( ( item ) => item.id === id );
}

export function isPendingApproval( state: State ) {
	return state.queue.some(
		( item ) => item.status === ItemStatus.PendingApproval
	);
}

export function getItemByAttachmentId( state: State, id: number ) {
	return state.queue.find(
		( item ) => item.attachment?.id === id || item.sourceAttachmentId === id
	);
}

export function isPendingApprovalByAttachmentId( state: State, id: number ) {
	return state.queue.some(
		( item ) =>
			( item.attachment?.id === id || item.sourceAttachmentId === id ) &&
			item.status === ItemStatus.PendingApproval
	);
}

export function isFirstPendingApprovalByAttachmentId(
	state: State,
	id: number
) {
	const foundItem = state.queue.find(
		( item ) => item.status === ItemStatus.PendingApproval
	);

	return (
		foundItem &&
		( foundItem.attachment?.id === id ||
			foundItem.sourceAttachmentId === id )
	);
}

export function getComparisonDataForApproval( state: State, id: number ) {
	const foundItem = state.queue.find(
		( item ) =>
			( item.attachment?.id === id || item.sourceAttachmentId === id ) &&
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

export function isBatchUploaded( state: State, batchId: BatchId ) {
	const batchItems = state.queue.filter(
		( item ) => batchId === item.batchId
	);
	return batchItems.length <= 1;
}

// Todo: change forceIsSaving in GB depending on this selector.
// See https://github.com/WordPress/gutenberg/blob/a889ec84318fe5ee9ee76f1226b30283b27c99a7/packages/edit-post/src/components/header/index.js#L35
export function isUploading( state: State ) {
	return state.queue.length >= 1;
}

export function isUploadingByUrl( state: State, url: string ) {
	return state.queue.some(
		( item ) => item.attachment?.url === url || item.sourceUrl === url
	);
}

export function isUploadingById( state: State, attachmentId: number ) {
	return state.queue.some(
		( item ) =>
			item.attachment?.id === attachmentId ||
			item.sourceAttachmentId === attachmentId
	);
}

export function isUploadingToPost( state: State, postOrAttachmentId: number ) {
	return state.queue.some(
		( item ) =>
			item.currentOperation === OperationType.Upload &&
			item.additionalData.post === postOrAttachmentId
	);
}
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

export function isUploadingByBatchId( state: State, batchId: BatchId ) {
	return state.queue.some( ( item ) => item.batchId === batchId );
}

export function getMediaSourceTermId( state: State, slug: MediaSourceTerm ) {
	return state.mediaSourceTerms[ slug ];
}

export function getImageSize( state: State, name: string ) {
	return state.imageSizes[ name ];
}
