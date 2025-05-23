/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * WordPress dependencies
 */
import type { createRegistry } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import { type MeasureOptions } from '@mexp/log';

/**
 * Internal dependencies
 */
import { UploadError } from '../upload-error';
import { getFileBasename, getFileNameFromUrl } from '../utils';
import { PREFERENCES_NAME } from '../constants';
import { StubFile } from '../stub-file';
import { vipsCancelOperations } from './utils/vips';
import type {
	AddAction,
	AdditionalData,
	ApproveUploadAction,
	BatchId,
	CancelAction,
	ImageLibrary,
	OnBatchSuccessHandler,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	QueueItem,
	QueueItemId,
	State,
	ThumbnailGeneration,
} from './types';
import { ItemStatus, OperationType, Type } from './types';
import type {
	addItem,
	processItem,
	removeItem,
	revokeBlobUrls,
} from './private-actions';

type WPDataRegistry = ReturnType< typeof createRegistry >;

type ActionCreators = {
	addItem: typeof addItem;
	addItems: typeof addItems;
	addItemFromUrl: typeof addItemFromUrl;
	removeItem: typeof removeItem;
	processItem: typeof processItem;
	cancelItem: typeof cancelItem;
	rejectApproval: typeof rejectApproval;
	grantApproval: typeof grantApproval;
	muteExistingVideo: typeof muteExistingVideo;
	addSubtitlesForExistingVideo: typeof addSubtitlesForExistingVideo;
	addPosterForExistingVideo: typeof addPosterForExistingVideo;
	optimizeExistingItem: typeof optimizeExistingItem;
	revokeBlobUrls: typeof revokeBlobUrls;
	< T = Record< string, unknown > >( args: T ): void;
};

type AllSelectors = typeof import('./selectors') &
	typeof import('./private-selectors');
type CurriedState< F > = F extends ( state: State, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
};

type ThunkArgs = {
	select: Selectors;
	dispatch: ActionCreators;
	registry: WPDataRegistry;
};

interface AddItemsArgs {
	files: File[];
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
}

/**
 * Adds a new item to the upload queue.
 *
 * @param $0
 * @param $0.files            Files
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onBatchSuccess] Function called after a batch of files is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 */
export function addItems( {
	files,
	onChange,
	onSuccess,
	onError,
	onBatchSuccess,
	additionalData,
}: AddItemsArgs ) {
	return async ( { dispatch }: ThunkArgs ) => {
		const batchId = uuidv4();
		for ( const file of files ) {
			dispatch.addItem( {
				file,
				batchId,
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				additionalData,
			} );
		}
	};
}

interface AddItemFromUrlArgs {
	url: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
	allowedTypes?: string[];
}

/**
 * Adds a new item to the upload queue.
 *
 * @param $0
 * @param $0.url              URL
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 * @param [$0.allowedTypes]   Array with the types of media that can be uploaded, if unset all types are allowed.
 */
export function addItemFromUrl( {
	url,
	onChange,
	onSuccess,
	onError,
	additionalData,
	allowedTypes,
}: AddItemFromUrlArgs ) {
	return async ( { dispatch }: ThunkArgs ) => {
		const fileName = getFileNameFromUrl( url );

		dispatch.addItem( {
			file: new StubFile(),
			onChange,
			onSuccess,
			onError,
			additionalData,
			sourceUrl: url,
			operations: [
				[
					OperationType.FetchRemoteFile,
					{ url, fileName, allowedTypes },
				],
				// This will add the next steps, such as compression, poster generation, and upload.
				OperationType.Prepare,
			],
		} );
	};
}

interface MuteExistingVideoArgs {
	id: number;
	url: string;
	fileName?: string;
	poster?: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
}

/**
 * Adds a new item to the upload queue for muting an existing video.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id               Attachment ID.
 * @param $0.url              Video URL.
 * @param [$0.fileName]       Video file name.
 * @param [$0.poster]         Poster URL.
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 */
export function muteExistingVideo( {
	id,
	url,
	fileName,
	poster,
	onChange,
	onSuccess,
	onError,
	additionalData = {} as AdditionalData,
}: MuteExistingVideoArgs ) {
	return async ( { dispatch }: ThunkArgs ) => {
		fileName = fileName || getFileNameFromUrl( url );
		const baseName = getFileBasename( fileName );
		const newFileName = fileName.replace( baseName, `${ baseName }-muted` );

		// TODO: Somehow add relation between original and muted video in db.

		// TODO: Check file size here to bail early? Or ideally already in the UI.

		// TODO: Copy over the auto-generated poster image.
		// What if the original attachment gets deleted though?
		// Maybe better to generate the poster image anew.

		// TODO: Maybe pass on the original as a "sourceAttachment"

		const itemId = uuidv4();

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				status: ItemStatus.Processing,
				sourceFile: new StubFile(),
				file: new StubFile(),
				attachment: {
					url,
					poster,
				},
				additionalData,
				onChange,
				onSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				operations: [
					[
						OperationType.FetchRemoteFile,
						{ url, fileName, newFileName },
					],
					OperationType.MuteVideo,
					OperationType.Upload,
				],
				abortController: new AbortController(),
			},
		} );

		dispatch.processItem( itemId );
	};
}

interface AddSubtitlesForExistingVideoArgs {
	id?: number;
	url: string;
	fileName?: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData: AdditionalData;
}

/**
 * Adds a new item to the upload queue to generate subtitles for an existing video.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id               Attachment ID.
 * @param $0.url              URL.
 * @param [$0.fileName]       File name.
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 */
export function addSubtitlesForExistingVideo( {
	id,
	url,
	fileName,
	onChange,
	onSuccess,
	onError,
	additionalData = {} as AdditionalData,
}: AddSubtitlesForExistingVideoArgs ) {
	return async ( { dispatch }: ThunkArgs ) => {
		fileName = fileName || getFileNameFromUrl( url );

		const itemId = uuidv4();

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				status: ItemStatus.Processing,
				file: new StubFile(),
				sourceFile: new StubFile(),
				onChange,
				onSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				additionalData,
				abortController: new AbortController(),
				operations: [
					/*
					 After FetchRemoteFile, item.file will be a video file first, not a VTT,
					 so do not create an attachment for it.
					*/
					[
						OperationType.FetchRemoteFile,
						{ url, fileName, skipAttachment: true },
					],
					OperationType.GenerateSubtitles,
					OperationType.Upload,
				],
			},
		} );

		dispatch.processItem( itemId );
	};
}

interface AddPosterForExistingVideoArgs {
	id?: number;
	url: string;
	fileName?: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData: AdditionalData;
}

/**
 * Adds a new item to the upload queue to generate a poster for an existing video.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id               Attachment ID.
 * @param $0.url              URL.
 * @param [$0.fileName]       File name.
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 */
export function addPosterForExistingVideo( {
	id,
	url,
	fileName,
	onChange,
	onSuccess,
	onError,
	additionalData = {} as AdditionalData,
}: AddPosterForExistingVideoArgs ) {
	return async ( { dispatch }: ThunkArgs ) => {
		fileName = fileName || getFileNameFromUrl( url );

		const itemId = uuidv4();

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				status: ItemStatus.Processing,
				file: new StubFile(),
				sourceFile: new StubFile( fileName ),
				onChange,
				onSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				additionalData,
				abortController: new AbortController(),
				operations: [
					OperationType.AddPoster,
					OperationType.TranscodeImage,
					OperationType.Upload,
				],
			},
		} );

		dispatch.processItem( itemId );
	};
}

interface OptimizeExistingItemArgs {
	id: number;
	url: string;
	fileName?: string;
	poster?: string;
	batchId?: BatchId;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
	startTime?: number;
}

/**
 * Adds a new item to the upload queue for optimizing (compressing) an existing item.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id               Attachment ID.
 * @param $0.url              URL.
 * @param [$0.fileName]       File name.
 * @param [$0.poster]         Poster URL.
 * @param [$0.batchId]        Batch ID.
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]      Function called after the file is uploaded.
 * @param [$0.onBatchSuccess] Function called after a batch of files is uploaded.
 * @param [$0.onError]        Function called when an error happens.
 * @param [$0.additionalData] Additional data to include in the request.
 * @param [$0.startTime]      Time the action was initiated by the user (e.g. by clicking on a button).
 */
export function optimizeExistingItem( {
	id,
	url,
	fileName,
	poster,
	batchId,
	onChange,
	onSuccess,
	onBatchSuccess,
	onError,
	additionalData = {} as AdditionalData,
	startTime,
}: OptimizeExistingItemArgs ) {
	return async ( { dispatch, registry }: ThunkArgs ) => {
		fileName = fileName || getFileNameFromUrl( url );
		const baseName = getFileBasename( fileName );
		const newFileName = fileName.replace(
			baseName,
			`${ baseName }-optimized`
		);

		const requireApproval = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'requireApproval' );

		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		// TODO: Same considerations apply as for muteExistingVideo.

		const abortController = new AbortController();

		const itemId = uuidv4();

		const timing: MeasureOptions = {
			measureName: `Optimize existing item ${ fileName }`,
			startTime: startTime || performance.now(),
			tooltipText: 'This is a rendering task',
			properties: [
				[ 'Item ID', itemId ],
				[ 'File name', fileName ],
			],
		};

		const timings = [ timing ];

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				batchId,
				status: ItemStatus.Processing,
				sourceFile: new StubFile(),
				file: new StubFile(),
				attachment: {
					url,
					poster,
				},
				additionalData: {
					generate_sub_sizes: 'server' === thumbnailGeneration,
					convert_format: false,
					...additionalData,
				},
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				operations: [
					[
						OperationType.FetchRemoteFile,
						{ url, fileName, newFileName },
					],
					[ OperationType.Compress, { requireApproval } ],
					OperationType.GenerateMetadata,
					OperationType.Upload,
					OperationType.ThumbnailGeneration,
				],
				abortController,
				timings,
			},
		} );

		dispatch.processItem( itemId );
	};
}

/**
 * Rejects a proposed optimized/converted version of a file
 * by essentially cancelling its further processing.
 *
 * @param id Item ID.
 */
export function rejectApproval( id: number ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItemByAttachmentId( id );
		if ( ! item ) {
			return;
		}

		dispatch.cancelItem(
			item.id,
			new UploadError( {
				code: 'UPLOAD_CANCELLED',
				message: 'File upload was cancelled',
				file: item.file,
			} ),
			true
		);
	};
}

/**
 * Approves a proposed optimized/converted version of a file
 * so it can continue being processed and uploaded.
 *
 * @param id Item ID.
 */
export function grantApproval( id: number ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItemByAttachmentId( id );
		if ( ! item ) {
			return;
		}

		dispatch< ApproveUploadAction >( {
			type: Type.ApproveUpload,
			id: item.id,
		} );

		dispatch.processItem( item.id );
	};
}

/**
 * Cancels an item in the queue based on an error.
 *
 * @param id     Item ID.
 * @param error  Error instance.
 * @param silent Whether to cancel the item silently,
 *               without invoking its `onError` callback.
 */
export function cancelItem( id: QueueItemId, error: Error, silent = false ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id );

		if ( ! item ) {
			/*
			 * Do nothing if item has already been removed.
			 * This can happen if an upload is cancelled manually
			 * while transcoding with vips is still in progress.
			 * Then, cancelItem() is once invoked manually and once
			 * by the error handler in optimizeImageItem().
			 */
			return;
		}

		// When cancelling a parent item, cancel all the children too.
		for ( const child of select.getChildItems( id ) ) {
			dispatch.cancelItem( child.id, error, silent );
		}

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		if ( 'vips' === imageLibrary ) {
			await vipsCancelOperations( id );
		}

		item.abortController?.abort();

		if ( ! silent ) {
			// TODO: Do not log error for children if cancelling a parent and all its children.
			const { onError } = item;
			onError?.( error ?? new Error( 'Upload cancelled' ) );
			if ( ! onError && error ) {
				// TODO: Find better way to surface errors with sideloads etc.
				// eslint-disable-next-line no-console -- Deliberately log errors here.
				console.error( 'Upload cancelled', error );
			}
		}

		dispatch< CancelAction >( {
			type: Type.Cancel,
			id,
			error,
		} );
		dispatch.removeItem( id );
		dispatch.revokeBlobUrls( id );

		// All items of this batch were cancelled or finished.
		if ( item.batchId && select.isBatchUploaded( item.batchId ) ) {
			item.onBatchSuccess?.();

			// All other side-loaded items have been removed, so remove the parent too.
			if ( item.parentId ) {
				const parentItem = select.getItem( item.parentId ) as QueueItem;

				dispatch.removeItem( item.parentId );
				dispatch.revokeBlobUrls( item.parentId );

				if (
					parentItem.batchId &&
					select.isBatchUploaded( parentItem.batchId )
				) {
					parentItem.onBatchSuccess?.();
				}
			}
		}
	};
}
