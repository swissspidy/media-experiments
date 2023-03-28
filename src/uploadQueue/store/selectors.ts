import { ItemStatus, QueueItemId, State } from './types';

export function getItems(state: State, status?: ItemStatus) {
	if (status) {
		return state.queue.filter((item) => item.status === status);
	}

	return state.queue;
}

export function getPendingItems(state: State) {
	return getItems(state, ItemStatus.Pending);
}

export function getPendingTranscodingItems(state: State) {
	return getItems(state, ItemStatus.PendingTranscoding);
}

export function getTranscodedItems(state: State) {
	return getItems(state, ItemStatus.Transcoded);
}

export function getApprovedItems(state: State) {
	return getItems(state, ItemStatus.Approved);
}

export function getUploadedItems(state: State) {
	return getItems(state, ItemStatus.Uploaded);
}

export function getCancelledItems(state: State) {
	return getItems(state, ItemStatus.Cancelled);
}

export function getInProgressItems(state: State) {
	return state.queue.filter(
		({ status }) =>
			![
				ItemStatus.Cancelled,
				ItemStatus.Pending,
				ItemStatus.Transcoding,
				ItemStatus.Uploading,
				ItemStatus.Uploaded,
			].includes(status)
	);
}

export function getItem(state: State, id: QueueItemId) {
	return state.queue.find((item) => item.id === id);
}

export function isTranscoding(state: State) {
	return state.queue.some(({ status }) => status === ItemStatus.Transcoding);
}

export function getItemByAttachmentId(state: State, id: number) {
	return state.queue.find(
		(item) => item.attachment?.id === id || item.sourceAttachmentId === id
	);
}

export function isPendingApprovalByAttachmentId(state: State, id: number) {
	return state.queue.some(
		(item) =>
			(item.attachment?.id === id || item.sourceAttachmentId === id) &&
			item.status === ItemStatus.PendingApproval
	);
}

export function getComparisonDataForApproval(state: State, id: number) {
	const foundItem = state.queue.find(
		(item) =>
			(item.attachment?.id === id || item.sourceAttachmentId === id) &&
			item.status === ItemStatus.PendingApproval
	);

	if (!foundItem) {
		return null;
	}

	return {
		oldUrl: foundItem.sourceUrl,
		oldSize: foundItem.sourceFile.size,
		newSize: foundItem.file.size,
		newUrl: foundItem.attachment?.url,
		sizeDiff: (1 - foundItem.file.size / foundItem.sourceFile.size) * 100,
	};
}

// Todo: change forceIsSaving in GB depending on this selector.
// See https://github.com/WordPress/gutenberg/blob/a889ec84318fe5ee9ee76f1226b30283b27c99a7/packages/edit-post/src/components/header/index.js#L35
export function isUploading(state: State) {
	return state.queue.some(
		({ status }) =>
			![ItemStatus.Cancelled, ItemStatus.Pending].includes(status)
	);
}

export function isUploadingByUrl(state: State, url: string) {
	return state.queue.some(
		(item) => item.attachment?.url === url || item.sourceUrl === url
	);
}

export function isUploadingById(state: State, id: number) {
	return state.queue.some(
		(item) => item.attachment?.id === id || item.sourceAttachmentId === id
	);
}

export function getMediaSourceTermId(state: State, slug: string) {
	return state.mediaSourceTerms[slug];
}
