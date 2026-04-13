/**
 * Internal dependencies
 */
import {
	type AddAction,
	type AddOperationsAction,
	type ApproveUploadAction,
	type CacheBlobUrlAction,
	type CancelAction,
	ItemStatus,
	type OperationFinishAction,
	type OperationStartAction,
	type PauseItemAction,
	type PauseQueueAction,
	type QueueItem,
	type RemoveAction,
	type ResumeItemAction,
	type ResumeQueueAction,
	type RevokeBlobUrlsAction,
	type State,
	Type,
	type UnknownAction,
	type UpdateSettingsAction,
} from './types';

const noop = () => {};

/**
 * Calculates a reasonable concurrency limit based on hardware capabilities.
 *
 * Uses navigator.hardwareConcurrency if available, with a sensible fallback.
 * Limits to a maximum of 8 concurrent operations to prevent overwhelming the system.
 *
 * @return The calculated concurrency limit.
 */
function calculateConcurrencyLimit(): number {
	const hardwareConcurrency =
		typeof navigator !== 'undefined' && navigator.hardwareConcurrency
			? navigator.hardwareConcurrency
			: 4;

	// Use half of available cores, with a minimum of 2 and maximum of 8
	return Math.max( 2, Math.min( 8, Math.floor( hardwareConcurrency / 2 ) ) );
}

const DEFAULT_STATE: State = {
	queue: [],
	queueStatus: 'active',
	pendingApproval: undefined,
	blobUrls: {},
	settings: {
		mediaUpload: noop,
		mediaSideload: noop,
		imageSizes: {},
	},
	concurrencyLimit: calculateConcurrencyLimit(),
};

type Action =
	| AddAction
	| RemoveAction
	| CancelAction
	| PauseItemAction
	| ResumeItemAction
	| PauseQueueAction
	| ResumeQueueAction
	| AddOperationsAction
	| ApproveUploadAction
	| OperationFinishAction
	| OperationStartAction
	| CacheBlobUrlAction
	| RevokeBlobUrlsAction
	| UpdateSettingsAction
	| UnknownAction;

function reducer(
	state = DEFAULT_STATE,
	action: Action = { type: Type.Unknown }
) {
	switch ( action.type ) {
		case Type.PauseQueue: {
			return {
				...state,
				queueStatus: 'paused',
			};
		}

		case Type.ResumeQueue: {
			return {
				...state,
				queueStatus: 'active',
			};
		}

		case Type.Add:
			return {
				...state,
				queue: [ ...state.queue, action.item ],
			};

		case Type.Cancel:
			return {
				...state,
				queue: state.queue.map(
					( item ): QueueItem =>
						item.id === action.id
							? {
									...item,
									error: action.error,
							  }
							: item
				),
				pendingApproval:
					state.pendingApproval !== action.id
						? state.pendingApproval
						: state.queue.find(
								( item ) =>
									item.status ===
										ItemStatus.PendingApproval &&
									item.id !== action.id
						  )?.id || undefined,
			};

		case Type.Remove:
			return {
				...state,
				queue: state.queue.filter( ( item ) => item.id !== action.id ),
			};

		case Type.PauseItem:
			return {
				...state,
				queue: state.queue.map(
					( item ): QueueItem =>
						item.id === action.id
							? {
									...item,
									status: ItemStatus.Paused,
							  }
							: item
				),
			};

		case Type.ResumeItem:
			return {
				...state,
				queue: state.queue.map(
					( item ): QueueItem =>
						item.id === action.id
							? {
									...item,
									status: ItemStatus.Processing,
							  }
							: item
				),
			};

		case Type.OperationStart: {
			return {
				...state,
				queue: state.queue.map(
					( item ): QueueItem =>
						item.id === action.id
							? {
									...item,
									currentOperation: action.operation,
							  }
							: item
				),
			};
		}

		case Type.AddOperations:
			return {
				...state,
				queue: state.queue.map( ( item ): QueueItem => {
					if ( item.id !== action.id ) {
						return item;
					}

					return {
						...item,
						operations: [
							...( item.operations || [] ),
							...action.operations,
						],
					};
				} ),
			};

		case Type.OperationFinish:
			return {
				...state,
				queue: state.queue.map( ( item ): QueueItem => {
					if ( item.id !== action.id ) {
						return item;
					}

					const operations = item.operations
						? item.operations.slice( 1 )
						: [];

					// Prevent an empty object if there's no attachment data.
					const attachment =
						item.attachment || action.item.attachment
							? {
									...item.attachment,
									...action.item.attachment,
							  }
							: undefined;

					return {
						...item,
						currentOperation: undefined,
						operations,
						...action.item,
						attachment,
						additionalData: {
							...item.additionalData,
							...action.item.additionalData,
						},
						timings: [
							...( item.timings || [] ),
							...( action.item.timings || [] ),
						],
					};
				} ),
				// eslint-disable-next-line no-nested-ternary
				pendingApproval: state.pendingApproval
					? state.pendingApproval
					: action.item.status === ItemStatus.PendingApproval
					? action.id
					: undefined,
			};

		case Type.ApproveUpload:
			return {
				...state,
				queue: state.queue.map(
					( item ): QueueItem =>
						item.id === action.id
							? {
									...item,
									status: ItemStatus.Processing,
							  }
							: item
				),
				pendingApproval:
					state.queue.find(
						( item ) =>
							item.status === ItemStatus.PendingApproval &&
							item.id !== action.id
					)?.id || undefined,
			};

		case Type.CacheBlobUrl: {
			const blobUrls = state.blobUrls[ action.id ] || [];
			return {
				...state,
				blobUrls: {
					...state.blobUrls,
					[ action.id ]: [ ...blobUrls, action.blobUrl ],
				},
			};
		}

		case Type.RevokeBlobUrls: {
			const newBlobUrls = { ...state.blobUrls };
			delete newBlobUrls[ action.id ];

			return {
				...state,
				blobUrls: newBlobUrls,
			};
		}

		case Type.UpdateSettings: {
			return {
				...state,
				settings: {
					...state.settings,
					...action.settings,
				},
			};
		}
	}

	return state;
}

export default reducer;
