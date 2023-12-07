import { getMediaTypeFromMimeType } from '@mexp/media-utils';

import {
	type AddAction,
	type AddPosterAction,
	type ApproveUploadAction,
	type CancelAction,
	ItemStatus,
	type PrepareAction,
	type RemoveAction,
	type RequestApprovalAction,
	type SetImageSizesAction,
	type SetMediaSourceTermsAction,
	type SideloadFinishAction,
	type State,
	type TranscodingFinishAction,
	type TranscodingPrepareAction,
	type TranscodingStartAction,
	Type,
	type UnknownAction,
	type UploadFinishAction,
	type UploadStartAction,
	type MediaSourceTerm,
} from './types';

const DEFAULT_STATE: State = {
	queue: [],
	mediaSourceTerms: {},
	imageSizes: {},
};

type Action =
	| UnknownAction
	| AddAction
	| PrepareAction
	| TranscodingPrepareAction
	| TranscodingStartAction
	| TranscodingFinishAction
	| UploadStartAction
	| UploadFinishAction
	| SideloadFinishAction
	| CancelAction
	| RemoveAction
	| AddPosterAction
	| SetMediaSourceTermsAction
	| SetImageSizesAction
	| RequestApprovalAction
	| ApproveUploadAction;

function reducer( state = DEFAULT_STATE, action: Action ) {
	switch ( action.type ) {
		case Type.Add:
			return {
				...state,
				queue: [ ...state.queue, action.item ],
			};
		case Type.Prepare:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Preparing,
						  }
						: item
				),
			};

		case Type.TranscodingPrepare:
			return {
				...state,
				queue: state.queue.map( ( item ) => {
					if ( item.id !== action.id ) {
						return item;
					}

					if ( ! action.transcode ) {
						return {
							...item,
							status: ItemStatus.PendingTranscoding,
						};
					}

					return {
						...item,
						status: ItemStatus.PendingTranscoding,
						transcode: item.transcode
							? [ ...item.transcode, ...action.transcode ]
							: [ ...action.transcode ],
					};
				} ),
			};

		case Type.TranscodingStart:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Transcoding,
						  }
						: item
				),
			};

		case Type.TranscodingFinish:
			return {
				...state,
				queue: state.queue.map( ( item ) => {
					if ( item.id !== action.id ) {
						return item;
					}

					const transcode = item.transcode
						? item.transcode.slice( 1 )
						: [];

					const mediaType = getMediaTypeFromMimeType(
						action.file.type
					);
					const mediaSourceTerms: MediaSourceTerm[] | undefined =
						[ 'video', 'image' ].includes( mediaType ) &&
						! item.mediaSourceTerms
							? [ 'media-optimization' ]
							: item.mediaSourceTerms;

					return {
						...item,
						status:
							transcode.length > 0
								? ItemStatus.PendingTranscoding
								: ItemStatus.Transcoded,
						transcode,
						file: action.file,
						attachment: {
							...item.attachment,
							url: action.url,
							mimeType: action.file.type,
						},
						mediaSourceTerms,
					};
				} ),
			};

		case Type.Cancel:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Cancelled,
								error: action.error,
						  }
						: item
				),
			};

		case Type.UploadStart:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Uploading,
						  }
						: item
				),
			};

		case Type.UploadFinish:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Uploaded,
								attachment: {
									...item.attachment,
									...action.attachment,
								},
								blurHash: action.attachment.blurHash,
								dominantColor: action.attachment.dominantColor,
						  }
						: item
				),
			};

		case Type.SideloadFinish:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								status: ItemStatus.Uploaded,
						  }
						: item
				),
			};

		case Type.AddPoster:
			return {
				...state,
				queue: state.queue.map( ( item ) =>
					item.id === action.id
						? {
								...item,
								poster: action.file,
								attachment: {
									...item.attachment,
									poster: action.url,
								},
						  }
						: item
				),
			};

		case Type.Remove:
			return {
				...state,
				queue: state.queue.filter( ( item ) => item.id !== action.id ),
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
								status: ItemStatus.Approved,
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
