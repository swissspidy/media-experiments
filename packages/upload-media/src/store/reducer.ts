import {
	type AddAction,
	type AddOperationsAction,
	type ApproveUploadAction,
	type CancelAction,
	type OperationFinishAction,
	type OperationStartAction,
	type PauseItemAction,
	type PauseQueueAction,
	type ResumeQueueAction,
	type RemoveAction,
	type RequestApprovalAction,
	type ResumeItemAction,
	type SetImageSizesAction,
	type SetMediaSourceTermsAction,
	type State,
	type UnknownAction,
	ItemStatus,
	Type,
} from './types';

const DEFAULT_STATE: State = {
	queue: [],
	mediaSourceTerms: {},
	imageSizes: {},
	queueStatus: 'active',
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
	| RequestApprovalAction
	| SetImageSizesAction
	| SetMediaSourceTermsAction
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
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								error: action.error,
						  }
						: item
				),
			};

		case Type.Remove:
			return {
				...state,
				queue: state.queue.filter( ( item ) => item.id !== action.id ),
			};

		case Type.PauseItem:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
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
				queue: state.queue.map( ( item ) =>
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
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								currentOperation: item.operations?.[ 0 ],
						  }
						: item
				),
			};
		}

		case Type.AddOperations:
			return {
				...state,
				queue: state.queue.map( ( item ) => {
					if ( item.id !== action.id ) {
						return item;
					}

					return {
						...item,
						operations: [
							...action.operations,
							...( item.operations || [] ),
						],
					};
				} ),
			};

		case Type.OperationFinish:
			return {
				...state,
				queue: state.queue.map( ( item ) => {
					if ( item.id !== action.id ) {
						return item;
					}

					const operations = item.operations
						? item.operations.slice( 1 )
						: [];

					return {
						...item,
						currentOperation: null,
						operations,
						...action.item,
						attachment: {
							...item.attachment,
							...action.item.attachment,
							// TODO: Update to pass this correctly.
							// url: action.item?.url,
							// mimeType: action.item?.file?.type,
						},
						additionalData: {
							...item.additionalData,
							...action.item.additionalData,
						},
						mediaSourceTerms: [
							...( item.mediaSourceTerms || [] ),
							...( action.item.mediaSourceTerms || [] ),
						],
					};
				} ),
			};

		case Type.RequestApproval:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.PendingApproval,
								file: action.file,
								attachment: {
									...item.attachment,
									url: action.url,
									mimeType: action.file.type,
								},
						  }
						: item
				),
			};

		case Type.ApproveUpload:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Processing,
						  }
						: item
				),
			};

		case Type.SetMediaSourceTerms: {
			return {
				...state,
				mediaSourceTerms: action.terms,
			};
		}

		case Type.SetImageSizes: {
			return {
				...state,
				imageSizes: action.imageSizes,
			};
		}
	}

	return state;
}

export default reducer;
