import { ItemStatus, QueueItemId, QueueState } from './types';

export function getItems(state: QueueState, status?: ItemStatus) {
	if (status) {
		return state.queue.filter((item) => item.status === status);
	}

	return state.queue;
}

export function getPendingItems(state: QueueState) {
	return getItems(state, ItemStatus.Pending);
}

export function getPendingTranscodingItems(state: QueueState) {
	return getItems(state, ItemStatus.PendingTranscoding);
}

export function getTranscodedItems(state: QueueState) {
	return getItems(state, ItemStatus.Transcoded);
}

export function getUploadedItems(state: QueueState) {
	return getItems(state, ItemStatus.Uploaded);
}

export function getCancelledItems(state: QueueState) {
	return getItems(state, ItemStatus.Cancelled);
}

export function getCompletedItems(state: QueueState) {
	return getItems(state, ItemStatus.Completed);
}

export function getInProgressItems(state: QueueState) {
	return state.queue.filter(
		({ status }) =>
			![
				ItemStatus.Completed,
				ItemStatus.Cancelled,
				ItemStatus.Pending,
			].includes(status)
	);
}

export function getItem(state: QueueState, id: QueueItemId) {
	return state.queue.find((item) => item.id === id);
}

export function isTranscoding(state: QueueState) {
	return state.queue.some(({ status }) => status == ItemStatus.Transcoding);
}

// Todo: change forceIsSaving in GB depending on this selector.
// See https://github.com/WordPress/gutenberg/blob/a889ec84318fe5ee9ee76f1226b30283b27c99a7/packages/edit-post/src/components/header/index.js#L35
export function isUploading(state: QueueState) {
	return state.queue.some(
		({ status }) =>
			![
				ItemStatus.Completed,
				ItemStatus.Cancelled,
				ItemStatus.Pending,
			].includes(status)
	);
}
