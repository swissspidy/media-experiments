import { v4 as uuidv4 } from 'uuid';
import { createWorkerFactory } from '@shopify/web-worker';

import { createBlobURL, isBlobURL, revokeBlobURL } from '@wordpress/blob';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

import { getExtensionFromMimeType, getMediaTypeFromMimeType } from '@mexp/mime';
import { measure, type MeasureOptions, start } from '@mexp/log';

import { ImageFile } from '../imageFile';
import { MediaError } from '../mediaError';
import {
	canProcessWithFFmpeg,
	cloneFile,
	fetchFile,
	getFileBasename,
	getFileExtension,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	isHeifImage,
	renameFile,
	videoHasAudio,
} from '../utils';
import { PREFERENCES_NAME } from '../constants';
import { transcodeHeifImage } from './utils/heif';
import {
	vipsCancelOperations,
	vipsCompressImage,
	vipsConvertImageFormat,
	vipsHasTransparency,
	vipsResizeImage,
} from './utils/vips';
import {
	compressImage as canvasCompressImage,
	convertImageFormat as canvasConvertImageFormat,
	resizeImage as canvasResizeImage,
} from './utils/canvas';
import type {
	AddAction,
	AdditionalData,
	AddOperationsAction,
	ApproveUploadAction,
	Attachment,
	AudioFormat,
	BatchId,
	CacheBlobUrlAction,
	CancelAction,
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	OnBatchSuccessHandler,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	Operation,
	OperationArgs,
	OperationFinishAction,
	OperationStartAction,
	PauseItemAction,
	PauseQueueAction,
	QueueItem,
	QueueItemId,
	ResumeItemAction,
	ResumeQueueAction,
	RevokeBlobUrlsAction,
	SetImageSizesAction,
	Settings,
	SideloadAdditionalData,
	State,
	ThumbnailGeneration,
	UpdateSettingsAction,
	VideoFormat,
} from './types';
import { ItemStatus, OperationType, Type } from './types';
import { StubFile } from '../stubFile';

const createDominantColorWorker = createWorkerFactory(
	() =>
		import(
			/* webpackChunkName: 'dominant-color' */ './workers/dominantColor'
		)
);
const dominantColorWorker = createDominantColorWorker();

const createBlurhashWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'blurhash' */ './workers/blurhash' )
);
const blurhashWorker = createBlurhashWorker();

// Safari does not currently support WebP in HTMLCanvasElement.toBlob()
// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
const isSafari = Boolean(
	window?.navigator.userAgent &&
		window.navigator.userAgent.includes( 'Safari' ) &&
		! window.navigator.userAgent.includes( 'Chrome' ) &&
		! window.navigator.userAgent.includes( 'Chromium' )
);

type ActionCreators = {
	addItem: typeof addItem;
	addItems: typeof addItems;
	addItemFromUrl: typeof addItemFromUrl;
	addSideloadItem: typeof addSideloadItem;
	removeItem: typeof removeItem;
	prepareItem: typeof prepareItem;
	processItem: typeof processItem;
	finishOperation: typeof finishOperation;
	uploadItem: typeof uploadItem;
	sideloadItem: typeof sideloadItem;
	cancelItem: typeof cancelItem;
	resumeItem: typeof resumeItem;
	addPosterForItem: typeof addPosterForItem;
	rejectApproval: typeof rejectApproval;
	grantApproval: typeof grantApproval;
	muteVideoItem: typeof muteVideoItem;
	muteExistingVideo: typeof muteExistingVideo;
	addSubtitlesForExistingVideo: typeof addSubtitlesForExistingVideo;
	addPosterForExistingVideo: typeof addPosterForExistingVideo;
	convertHeifItem: typeof convertHeifItem;
	resizeCropItem: typeof resizeCropItem;
	convertGifItem: typeof convertGifItem;
	optimizeExistingItem: typeof optimizeExistingItem;
	optimizeVideoItem: typeof optimizeVideoItem;
	optimizeAudioItem: typeof optimizeAudioItem;
	optimizeImageItem: typeof optimizeImageItem;
	generateThumbnails: typeof generateThumbnails;
	uploadOriginal: typeof uploadOriginal;
	uploadPoster: typeof uploadPoster;
	revokeBlobUrls: typeof revokeBlobUrls;
	fetchRemoteFile: typeof fetchRemoteFile;
	generateSubtitles: typeof generateSubtitles;
	< T = Record< string, unknown > >( args: T ): void;
};

type AllSelectors = typeof import('./selectors');
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

/**
 * Returns an action object that pauses all processing in the queue.
 *
 * Useful for testing purposes.
 *
 * @param settings
 * @return Action object.
 */
export function updateSettings(
	settings: Partial< Settings >
): UpdateSettingsAction {
	return {
		type: Type.UpdateSettings,
		settings,
	};
}

interface AddItemArgs {
	file: File;
	batchId?: BatchId;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	additionalData?: AdditionalData;
	sourceUrl?: string;
	sourceAttachmentId?: number;
	blurHash?: string;
	dominantColor?: string;
	abortController?: AbortController;
	operations?: Operation[];
}

/**
 * Adds a new item to the upload queue.
 *
 * @todo Revisit blurHash and dominantColor fields.
 *
 * @param $0
 * @param $0.file                 File
 * @param [$0.batchId]            Batch ID.
 * @param [$0.onChange]           Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]          Function called after the file is uploaded.
 * @param [$0.onBatchSuccess]     Function called after a batch of files is uploaded.
 * @param [$0.onError]            Function called when an error happens.
 * @param [$0.additionalData]     Additional data to include in the request.
 * @param [$0.sourceUrl]          Source URL. Used when importing a file from a URL or optimizing an existing file.
 * @param [$0.sourceAttachmentId] Source attachment ID. Used when optimizing an existing file for example.
 * @param [$0.blurHash]           Item's BlurHash.
 * @param [$0.dominantColor]      Item's dominant color.
 * @param [$0.abortController]    Abort controller for upload cancellation.
 * @param [$0.operations]         List of operations to perform. Defaults to automatically determined list, based on the file.
 */
export function addItem( {
	file,
	batchId,
	onChange,
	onSuccess,
	onBatchSuccess,
	onError,
	additionalData = {} as AdditionalData,
	sourceUrl,
	sourceAttachmentId,
	blurHash,
	dominantColor,
	abortController,
	operations,
}: AddItemArgs ) {
	return async ( {
		dispatch,
		registry,
	}: {
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		const itemId = uuidv4();

		const blobUrl = createBlobURL( file );
		dispatch< CacheBlobUrlAction >( {
			type: Type.CacheBlobUrl,
			id: itemId,
			blobUrl,
		} );

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				batchId,
				status: ItemStatus.Processing,
				sourceFile: cloneFile( file ),
				file,
				attachment: {
					url: blobUrl,
				},
				additionalData: {
					generate_sub_sizes: 'server' === thumbnailGeneration,
					...additionalData,
				},
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				sourceUrl,
				sourceAttachmentId,
				blurHash,
				dominantColor,
				abortController: abortController || new AbortController(),
				operations,
			},
		} );

		dispatch.prepareItem( itemId );
	};
}

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
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
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
 */
export function addItemFromUrl( {
	url,
	onChange,
	onSuccess,
	onError,
	additionalData,
}: AddItemFromUrlArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const fileName = getFileNameFromUrl( url );

		dispatch.addItem( {
			file: new StubFile(),
			onChange,
			onSuccess,
			onError,
			additionalData,
			sourceUrl: url,
			operations: [
				[ OperationType.FetchRemoteFile, { url, fileName } ],
				OperationType.AddPoster,
				OperationType.Upload,
			],
		} );
	};
}

interface AddSideloadItemArgs {
	file: File;
	onChange?: OnChangeHandler;
	additionalData?: AdditionalData;
	operations?: Operation[];
	batchId?: BatchId;
	parentId?: QueueItemId;
}

/**
 * Adds a new item to the upload queue for sideloading.
 *
 * This is typically a poster image or a client-side generated thumbnail.
 *
 * @param $0
 * @param $0.file             File
 * @param [$0.batchId]        Batch ID.
 * @param [$0.parentId]       Parent ID.
 * @param [$0.onChange]       Function called each time a file or a temporary representation of the file is available.
 * @param [$0.additionalData] Additional data to include in the request.
 * @param [$0.operations]     List of operations to perform. Defaults to automatically determined list, based on the file.
 */
export function addSideloadItem( {
	file,
	onChange,
	additionalData,
	operations,
	batchId,
	parentId,
}: AddSideloadItemArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const itemId = uuidv4();
		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				batchId,
				status: ItemStatus.Processing,
				sourceFile: cloneFile( file ),
				file,
				onChange,
				additionalData: {
					generate_sub_sizes: false,
					...additionalData,
				},
				parentId,
				operations,
				abortController: new AbortController(),
			},
		} );

		dispatch.prepareItem( itemId );
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
	blurHash?: string;
	dominantColor?: string;
	generatedPosterId?: number;
}

/**
 * Adds a new item to the upload queue for muting an existing video.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id                  Attachment ID.
 * @param $0.url                 Video URL.
 * @param [$0.fileName]          Video file name.
 * @param [$0.poster]            Poster URL.
 * @param [$0.onChange]          Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]         Function called after the file is uploaded.
 * @param [$0.onError]           Function called when an error happens.
 * @param [$0.additionalData]    Additional data to include in the request.
 * @param [$0.blurHash]          Item's BlurHash.
 * @param [$0.dominantColor]     Item's dominant color.
 * @param [$0.generatedPosterId] Attachment ID of the generated poster image, if it exists.
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
	blurHash,
	dominantColor,
	generatedPosterId,
}: MuteExistingVideoArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
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
				blurHash,
				dominantColor,
				operations: [
					[
						OperationType.FetchRemoteFile,
						{ url, fileName, newFileName },
					],
					OperationType.MuteVideo,
					OperationType.Upload,
				],
				generatedPosterId,
				abortController: new AbortController(),
			},
		} );

		dispatch.prepareItem( itemId );
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
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
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

		dispatch.prepareItem( itemId );
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
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
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

		dispatch.prepareItem( itemId );
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
	blurHash?: string;
	dominantColor?: string;
	generatedPosterId?: number;
	startTime?: number;
}

/**
 * Adds a new item to the upload queue for optimizing (compressing) an existing item.
 *
 * @todo Rename id to sourceAttachmentId for consistency
 *
 * @param $0
 * @param $0.id                  Attachment ID.
 * @param $0.url                 URL.
 * @param [$0.fileName]          File name.
 * @param [$0.poster]            Poster URL.
 * @param [$0.batchId]           Batch ID.
 * @param [$0.onChange]          Function called each time a file or a temporary representation of the file is available.
 * @param [$0.onSuccess]         Function called after the file is uploaded.
 * @param [$0.onBatchSuccess]    Function called after a batch of files is uploaded.
 * @param [$0.onError]           Function called when an error happens.
 * @param [$0.additionalData]    Additional data to include in the request.
 * @param [$0.blurHash]          Item's BlurHash.
 * @param [$0.dominantColor]     Item's dominant color.
 * @param [$0.generatedPosterId] Attachment ID of the generated poster image, if it exists.
 * @param [$0.startTime]         Time the action was initiated by the user (e.g. by clicking on a button).
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
	blurHash,
	dominantColor,
	generatedPosterId,
	startTime,
}: OptimizeExistingItemArgs ) {
	return async ( {
		dispatch,
		registry,
	}: {
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
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
			hintText: 'This is a rendering task',
			detailsPairs: [
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
					...additionalData,
				},
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				blurHash,
				dominantColor,
				operations: [
					[
						OperationType.FetchRemoteFile,
						{ url, fileName, newFileName },
					],
					[ OperationType.Compress, { requireApproval } ],
					OperationType.Upload,
				],
				generatedPosterId,
				abortController,
				timings,
			},
		} );

		dispatch.prepareItem( itemId );
	};
}

/**
 * Processes a single item in the queue.
 *
 * Runs the next operation in line and invokes any callbacks.
 *
 * @param id Item ID.
 */
export function processItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		if ( select.isPaused() ) {
			return;
		}

		const item = select.getItem( id ) as QueueItem;

		if ( item.status === ItemStatus.PendingApproval ) {
			return;
		}

		const {
			attachment,
			onChange,
			onSuccess,
			onBatchSuccess,
			batchId,
			parentId,
		} = item;

		const operation = Array.isArray( item.operations?.[ 0 ] )
			? item.operations[ 0 ][ 0 ]
			: item.operations?.[ 0 ];
		// TODO: Improve type here to avoid using "as" further down.
		const operationArgs = Array.isArray( item.operations?.[ 0 ] )
			? item.operations[ 0 ][ 1 ]
			: undefined;

		// If we're sideloading a thumbnail, pause upload to avoid race conditions.
		// It will be resumed after the previous upload finishes.
		if (
			operation === OperationType.Upload &&
			item.parentId &&
			item.additionalData.post
		) {
			const isAlreadyUploading = select.isUploadingToPost(
				item.additionalData.post as number
			);
			if ( isAlreadyUploading ) {
				dispatch< PauseItemAction >( {
					type: Type.PauseItem,
					id,
				} );
				return;
			}
		}

		if ( attachment ) {
			onChange?.( [ attachment ] );
		}

		/*
		 If there are no more operations, the item can be removed from the queue,
		 but only if there are no thumbnails still being side-loaded,
		 or if itself is a side-loaded item.
		*/

		if ( ! operation ) {
			const isBatchUploaded =
				batchId && select.isBatchUploaded( batchId );

			if (
				parentId ||
				( ! parentId && ! select.isUploadingByParentId( id ) )
			) {
				if ( attachment ) {
					onSuccess?.( [ attachment ] );
				}
				if ( isBatchUploaded ) {
					onBatchSuccess?.();
				}

				dispatch.removeItem( id );
				dispatch.revokeBlobUrls( id );
			}

			// All other side-loaded items have been removed, so remove the parent too.
			if ( parentId && isBatchUploaded ) {
				const parentItem = select.getItem( parentId ) as QueueItem;

				if ( attachment ) {
					parentItem.onSuccess?.( [ attachment ] );
				}

				if (
					parentItem.batchId &&
					select.isBatchUploaded( parentItem.batchId )
				) {
					parentItem.onBatchSuccess?.();
				}

				dispatch.removeItem( parentId );
				dispatch.revokeBlobUrls( parentId );
			}

			/*
			 At this point we are dealing with a parent whose children haven't fully uploaded yet.
			 Do nothing and let the removal happen once the last side-loaded item finishes.
			 */

			return;
		}

		if ( ! operation ) {
			// This shouldn't really happen.
			return;
		}

		dispatch< OperationStartAction >( {
			type: Type.OperationStart,
			id,
			operation,
		} );

		switch ( operation ) {
			case OperationType.ResizeCrop:
				dispatch.resizeCropItem(
					item.id,
					operationArgs as OperationArgs[ OperationType.ResizeCrop ]
				);
				break;

			case OperationType.TranscodeHeif:
				dispatch.convertHeifItem( item.id );
				break;

			case OperationType.TranscodeGif:
				dispatch.convertGifItem( item.id );
				break;

			case OperationType.TranscodeAudio:
				dispatch.optimizeAudioItem( item.id );
				break;

			case OperationType.TranscodeVideo:
				dispatch.optimizeVideoItem( item.id );
				break;

			case OperationType.MuteVideo:
				dispatch.muteVideoItem( item.id );
				break;

			case OperationType.TranscodeImage:
				dispatch.optimizeImageItem(
					item.id,
					operationArgs as OperationArgs[ OperationType.TranscodeImage ]
				);
				break;

			// TODO: Right now only handles images, but should support other types too.
			case OperationType.Compress:
				dispatch.optimizeImageItem(
					item.id,
					operationArgs as OperationArgs[ OperationType.TranscodeImage ]
				);
				break;

			case OperationType.AddPoster:
				dispatch.addPosterForItem( item.id );
				break;

			case OperationType.Upload:
				if ( item.parentId ) {
					dispatch.sideloadItem( id );
				} else {
					dispatch.uploadItem( id );
				}
				break;

			case OperationType.ThumbnailGeneration:
				dispatch.generateThumbnails( id );
				break;

			case OperationType.UploadOriginal:
				dispatch.uploadOriginal( id );
				break;

			case OperationType.UploadPoster:
				dispatch.uploadPoster( id );
				break;

			case OperationType.FetchRemoteFile:
				dispatch.fetchRemoteFile(
					id,
					operationArgs as OperationArgs[ OperationType.FetchRemoteFile ]
				);
				break;

			case OperationType.GenerateSubtitles:
				dispatch.generateSubtitles( id );
				break;
		}
	};
}

/**
 * Resumes processing for a given post/attachment ID.
 *
 * @param postOrAttachmentId Post or attachment ID.
 */
export function resumeItem( postOrAttachmentId: number ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getPausedUploadForPost( postOrAttachmentId );
		if ( item ) {
			dispatch< ResumeItemAction >( {
				type: Type.ResumeItem,
				id: item.id,
			} );
			dispatch.processItem( item.id );
		}
	};
}

/**
 * Returns an action object that pauses all processing in the queue.
 *
 * Useful for testing purposes.
 *
 * @return Action object.
 */
export function pauseQueue(): PauseQueueAction {
	return {
		type: Type.PauseQueue,
	};
}

/**
 * Resumes all processing in the queue.
 *
 * Dispatches an action object for resuming the queue itself,
 * and triggers processing for each remaining item in the queue individually.
 */
export function resumeQueue() {
	return async ( { select, dispatch }: ThunkArgs ) => {
		dispatch< ResumeQueueAction >( {
			type: Type.ResumeQueue,
		} );

		for ( const item of select.getItems() ) {
			dispatch.processItem( item.id );
		}
	};
}

/**
 * Removes a specific item from the queue.
 *
 * @param id Item ID.
 */
export function removeItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		if ( item.timings ) {
			for ( const timing of item.timings ) {
				measure( timing );
			}
		}

		dispatch( {
			type: Type.Remove,
			id,
		} );
	};
}

/**
 * Finishes an operation for a given item ID and immediately triggers processing the next one.
 *
 * @param id      Item ID.
 * @param updates Updated item data.
 */
export function finishOperation(
	id: QueueItemId,
	updates: Partial< QueueItem >
) {
	return async ( { dispatch }: ThunkArgs ) => {
		dispatch< OperationFinishAction >( {
			type: Type.OperationFinish,
			id,
			item: updates,
		} );

		dispatch.processItem( id );
	};
}

/**
 * Triggers poster image generation for an item.
 *
 * @param id Item ID.
 */
export function addPosterForItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id ) as QueueItem;

		// Bail early if the video already has a poster.
		if ( item.poster ) {
			dispatch.finishOperation( id, {} );
			return;
		}

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		try {
			switch ( mediaType ) {
				case 'video':
					const src = createBlobURL( item.file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: src,
					} );

					const poster = await getPosterFromVideo(
						src,
						`${ getFileBasename( item.sourceFile.name ) }-poster`
					);

					const posterUrl = createBlobURL( poster );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: posterUrl,
					} );

					dispatch.finishOperation( id, {
						poster,
						attachment: {
							poster: posterUrl,
						},
					} );

					break;

				case 'pdf':
					const { getImageFromPdf } = await import(
						/* webpackChunkName: 'pdf' */ '@mexp/pdf'
					);

					const pdfSrc = createBlobURL( item.file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: pdfSrc,
					} );

					// TODO: is this the right place?
					// Note: Causes another state update.
					const pdfThumbnail = await getImageFromPdf(
						pdfSrc,
						// Same suffix as WP core uses, see https://github.com/WordPress/wordpress-develop/blob/8a5daa6b446e8c70ba22d64820f6963f18d36e92/src/wp-admin/includes/image.php#L609-L634
						`${ getFileBasename( item.file.name ) }-pdf`
					);

					const pdfThumbnailUrl = createBlobURL( pdfThumbnail );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: pdfThumbnailUrl,
					} );

					dispatch.finishOperation( id, {
						poster: pdfThumbnail,
						attachment: {
							poster: pdfThumbnailUrl,
						},
					} );
					break;

				default:
					// We're dealing with a StubFile, e.g. via addPosterForExistingVideo() or addItemFromUrl().
					const file = await getPosterFromVideo(
						// @ts-ignore -- Expected to exist at this point.
						item.sourceUrl,
						`${ getFileBasename( item.sourceFile.name ) }-poster`
					);

					const blobURL = createBlobURL( file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: blobURL,
					} );

					dispatch.finishOperation( id, {
						file,
						attachment: {
							url: blobURL,
						},
					} );
			}
		} catch ( err ) {
			// Do not throw error. Could be a simple error such as video playback not working in tests.

			dispatch.finishOperation( id, {} );
		}
	};
}

/**
 * Prepares an item for initial processing.
 *
 * Determines the list of operations to perform for a given image,
 * depending on its media type.
 *
 * For example, HEIF images first need to be converted, resized,
 * compressed, and then uploaded.
 *
 * Or videos need to be compressed, and then need poster generation
 * before upload.
 *
 * @param id Item ID.
 */
export function prepareItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const { file } = item;

		// TODO: Check canTranscode either here, in muteExistingVideo, or in the UI.

		// Transcoding type has already been set, e.g. via muteExistingVideo() or addSideloadItem().
		// Also allow empty arrays, useful for example when sideloading original image.
		if ( item.operations !== undefined ) {
			dispatch.processItem( id );
			return;
		}

		const mediaType = getMediaTypeFromMimeType( file.type );

		const operations: Operation[] = [];

		switch ( mediaType ) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				const isGif = isAnimatedGif( fileBuffer );

				const convertAnimatedGifs: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'gif_convert' );

				if (
					isGif &&
					window.crossOriginIsolated &&
					convertAnimatedGifs
				) {
					operations.push(
						OperationType.TranscodeGif,
						OperationType.AddPoster,
						OperationType.Upload,
						// Try poster generation again *after* upload if it's still missing.
						OperationType.AddPoster,
						OperationType.UploadPoster
					);

					break;
				}

				const isHeif = isHeifImage( fileBuffer );

				if ( isHeif ) {
					operations.push( OperationType.TranscodeHeif );
				}

				const imageSizeThreshold: number = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'bigImageSizeThreshold' );

				if ( imageSizeThreshold ) {
					operations.push( [
						OperationType.ResizeCrop,
						{
							resize: {
								width: imageSizeThreshold,
								height: imageSizeThreshold,
							},
						},
					] );
				}

				const optimizeOnUpload: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'optimizeOnUpload' );

				if ( optimizeOnUpload ) {
					operations.push( OperationType.TranscodeImage );
				}

				operations.push(
					OperationType.Upload,
					OperationType.ThumbnailGeneration
				);

				const keepOriginal: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'keepOriginal' );

				if ( ( imageSizeThreshold && keepOriginal ) || isHeif ) {
					operations.push( OperationType.UploadOriginal );
				}

				break;

			case 'video':
				// Here we are potentially dealing with an unsupported file type (e.g. MOV)
				// that cannot be *played* by the browser, but could still be used for generating a poster.

				operations.push( OperationType.AddPoster );

				// TODO: First check if video already meets criteria.
				// No need to compress a video that's already quite small.

				if (
					window.crossOriginIsolated &&
					canProcessWithFFmpeg( file )
				) {
					operations.push( OperationType.TranscodeVideo );
				}

				operations.push(
					OperationType.Upload,
					// Try poster generation again *after* upload if it's still missing.
					OperationType.AddPoster,
					OperationType.UploadPoster
				);

				break;

			case 'audio':
				if (
					window.crossOriginIsolated &&
					canProcessWithFFmpeg( file )
				) {
					operations.push( OperationType.TranscodeAudio );
				}

				operations.push( OperationType.Upload );

				break;

			case 'pdf':
				operations.push(
					OperationType.AddPoster,
					OperationType.Upload,
					OperationType.ThumbnailGeneration
				);

				break;

			default:
				operations.push( OperationType.Upload );

				break;
		}

		dispatch< AddOperationsAction >( {
			type: Type.AddOperations,
			id,
			operations,
		} );

		dispatch.processItem( id );
	};
}

/**
 * Adds an item's poster image to the queue for uploading.
 *
 * @param id Item ID.
 */
export function uploadPoster( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const attachment: Attachment = item.attachment as Attachment;

		// In the event that the uploaded video already has a poster, do not upload another one.
		// Can happen when using muteExistingVideo() or when a poster is generated server-side.
		// TODO: Make the latter scenario actually work.
		//       Use getEntityRecord to actually get poster URL from posterID returned by uploadToServer()
		if (
			( ! attachment.poster || isBlobURL( attachment.poster ) ) &&
			item.poster
		) {
			try {
				const abortController = new AbortController();

				const operations: Operation[] = [];

				const imageSizeThreshold: number = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'bigImageSizeThreshold' );

				if ( imageSizeThreshold ) {
					operations.push( [
						OperationType.ResizeCrop,
						{
							resize: {
								width: imageSizeThreshold,
								height: imageSizeThreshold,
							},
						},
					] );
				}

				const outputFormat: ImageFormat = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_outputFormat' );

				const outputQuality: number = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_quality' );

				const interlaced: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_interlaced' );

				operations.push(
					[
						OperationType.TranscodeImage,
						{ outputFormat, outputQuality, interlaced },
					],
					OperationType.Upload,
					OperationType.ThumbnailGeneration,
					OperationType.UploadOriginal
				);

				// Adding the poster to the queue on its own allows for it to be optimized, etc.
				dispatch.addItem( {
					file: item.poster,
					onChange: ( [ posterAttachment ] ) => {
						if (
							! posterAttachment.url ||
							isBlobURL( posterAttachment.url )
						) {
							return;
						}

						// Video block expects such a structure for the poster.
						// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
						// TODO: Pass poster ID as well so that the video block can update `featured_media` via the REST API.
						const updatedAttachment = {
							...attachment,
							image: {
								src: posterAttachment.url,
							},
						};

						// This might be confusing, but the idea is to update the original
						// video item in the editor with the newly uploaded poster.
						item.onChange?.( [ updatedAttachment ] );
					},
					additionalData: {
						// Reminder: Parent post ID might not be set, depending on context,
						// but should be carried over if it does.
						post: item.additionalData.post,
					},
					blurHash: item.blurHash,
					dominantColor: item.dominantColor,
					abortController,
					operations,
				} );
			} catch ( err ) {
				// TODO: Debug & catch & throw.
			}
		}

		dispatch.finishOperation( id, {} );
	};
}

/**
 * Adds thumbnail versions to the queue for sideloading.
 *
 * @param id Item ID.
 */
export function generateThumbnails( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const attachment: Attachment = item.attachment as Attachment;

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		// Client-side thumbnail generation.
		// Works for images and PDF posters.

		if (
			! item.parentId &&
			attachment.missing_image_sizes &&
			'server' !== thumbnailGeneration
		) {
			let file = attachment.mexp_filename
				? renameFile( item.file, attachment.mexp_filename )
				: item.file;
			const batchId = uuidv4();

			if ( 'pdf' === mediaType && item.poster ) {
				file = item.poster;

				const outputFormat: ImageFormat = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_outputFormat' );

				const outputQuality: number = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_quality' );

				const interlaced: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'default_interlaced' );

				// Upload the "full" version without a resize param.
				dispatch.addSideloadItem( {
					file: item.poster,
					additionalData: {
						// Sideloading does not use the parent post ID but the
						// attachment ID as the image sizes need to be added to it.
						post: attachment.id,
						image_size: 'full',
					},
					operations: [
						[
							OperationType.TranscodeImage,
							{ outputFormat, outputQuality, interlaced },
						],
						OperationType.Upload,
					],
					parentId: item.id,
				} );
			}

			for ( const name of attachment.missing_image_sizes ) {
				const imageSize = select.getImageSize( name );
				if ( imageSize ) {
					// Force thumbnails to be soft crops, see wp_generate_attachment_metadata().
					if ( 'pdf' === mediaType && 'thumbnail' === name ) {
						imageSize.crop = false;
					}

					dispatch.addSideloadItem( {
						file,
						onChange: ( [ updatedAttachment ] ) => {
							// This might be confusing, but the idea is to update the original
							// image item in the editor with the new one with the added sub-size.
							item.onChange?.( [ updatedAttachment ] );
						},
						batchId,
						parentId: item.id,
						additionalData: {
							// Sideloading does not use the parent post ID but the
							// attachment ID as the image sizes need to be added to it.
							post: attachment.id,
							// Reference the same upload_request if needed.
							upload_request: item.additionalData.upload_request,
							image_size: name,
						},
						operations: [
							[ OperationType.ResizeCrop, { resize: imageSize } ],
							OperationType.Upload,
						],
					} );
				}
			}
		}

		dispatch.finishOperation( id, {} );
	};
}

/**
 * Adds the original file to the queue for sideloading.
 *
 * If an item was downsized due to the big image size threshold,
 * this adds the original file for storing.
 *
 * @param id Item ID.
 */
export function uploadOriginal( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const attachment: Attachment = item.attachment as Attachment;

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		/*
		 Upload the original image file if it was a HEIF image,
		 or if it was resized because of the big image size threshold.
		*/

		if ( 'image' === mediaType ) {
			if (
				! item.parentId &&
				( ( item.file instanceof ImageFile && item.file?.wasResized ) ||
					isHeifImage( await item.sourceFile.arrayBuffer() ) )
			) {
				const originalBaseName = getFileBasename(
					attachment.mexp_filename || item.file.name
				);

				dispatch.addSideloadItem( {
					file: renameFile(
						item.sourceFile,
						`${ originalBaseName }-original.${ getFileExtension(
							item.sourceFile.name
						) }`
					),
					parentId: item.id,
					additionalData: {
						// Sideloading does not use the parent post ID but the
						// attachment ID as the image sizes need to be added to it.
						post: attachment.id,
						// Reference the same upload_request if needed.
						upload_request: item.additionalData.upload_request,
						image_size: 'original',
					},
					// Skip any resizing or optimization of the original image.
					operations: [ OperationType.Upload ],
				} );
			}
		}

		dispatch.finishOperation( id, {} );
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
			new MediaError( {
				code: 'UPLOAD_CANCELLED',
				message: 'File upload was cancelled',
				file: item.file,
			} )
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
 * @param id    Item ID.
 * @param error Error instance.
 */
export function cancelItem( id: QueueItemId, error: Error ) {
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
		for ( const child of select
			.getItems()
			.filter( ( _item ) => _item.parentId === id ) ) {
			dispatch.cancelItem( child.id, error );
		}

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		if ( 'vips' === imageLibrary ) {
			await vipsCancelOperations( id );
		}

		item.abortController?.abort();

		// TODO: Do not log error for children if cancelling a parent and all its children.
		const { onError } = item;
		onError?.( error ?? new Error( 'Upload cancelled' ) );
		if ( ! onError && error ) {
			// TODO: Find better way to surface errors with sideloads etc.
			// eslint-disable-next-line no-console -- Deliberately log errors here.
			console.error( 'Upload cancelled', error );
		}

		dispatch< CancelAction >( {
			type: Type.Cancel,
			id,
			error,
		} );
		dispatch.removeItem( id );
		dispatch.revokeBlobUrls( id );
	};
}

type OptimizeImageItemArgs = OperationArgs[ OperationType.TranscodeImage ];

/**
 * Optimizes/Compresses an existing image item.
 *
 * @param id     Item ID.
 * @param [args] Additional arguments for the operation.
 */
export function optimizeImageItem(
	id: QueueItemId,
	args?: OptimizeImageItemArgs
) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const startTime = performance.now();

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		let stop: undefined | ( () => void );

		try {
			let file: File;

			const inputFormat = getExtensionFromMimeType( item.file.type );

			if ( ! inputFormat ) {
				throw new Error( 'Unsupported file type' );
			}

			const outputFormat: ImageFormat =
				args?.outputFormat ||
				registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, `${ inputFormat }_outputFormat` ) ||
				inputFormat;

			const outputQuality: number =
				args?.outputQuality ||
				registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, `${ inputFormat }_quality` ) ||
				80;

			const interlaced: boolean =
				args?.interlaced ||
				registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, `${ inputFormat }_interlaced` ) ||
				false;

			stop = start(
				`Optimize Item: ${ item.file.name } | ${ imageLibrary } | ${ inputFormat } | ${ outputFormat } | ${ outputQuality }`
			);

			switch ( outputFormat ) {
				case inputFormat:
				default:
					if ( 'browser' === imageLibrary ) {
						file = await canvasCompressImage(
							item.file,
							outputQuality / 100
						);
					} else {
						file = await vipsCompressImage(
							item.id,
							item.file,
							outputQuality / 100,
							interlaced
						);
					}
					break;

				case 'webp':
					// Safari doesn't support WebP in HTMLCanvasElement.toBlob().
					// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
					if ( 'browser' === imageLibrary && ! isSafari ) {
						file = await canvasConvertImageFormat(
							item.file,
							'image/webp',
							outputQuality / 100
						);
					} else {
						file = await vipsConvertImageFormat(
							item.id,
							item.file,
							'image/webp',
							outputQuality / 100
						);
					}
					break;

				case 'avif':
					// No browsers support AVIF in HTMLCanvasElement.toBlob() yet, so always use vips.
					// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
					file = await vipsConvertImageFormat(
						item.id,
						item.file,
						'image/avif',
						outputQuality / 100
					);
					break;

				case 'gif':
					// Browsers don't typically support image/gif in HTMLCanvasElement.toBlob() yet, so always use vips.
					// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
					file = await vipsConvertImageFormat(
						item.id,
						item.file,
						'image/avif',
						outputQuality / 100,
						interlaced
					);
					break;

				case 'jpeg':
				case 'png':
					if ( 'browser' === imageLibrary ) {
						file = await canvasConvertImageFormat(
							item.file,
							`image/${ outputFormat }`,
							outputQuality / 100
						);
					} else {
						file = await vipsConvertImageFormat(
							item.id,
							item.file,
							`image/${ outputFormat }`,
							outputQuality / 100,
							interlaced
						);
					}
			}

			if ( item.file instanceof ImageFile ) {
				file = new ImageFile(
					file,
					item.file.width,
					item.file.height,
					item.file.originalWidth,
					item.file.originalHeight
				);
			}

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			const endTime = performance.now();

			const timing: MeasureOptions = {
				measureName: `Optimize image ${ item.file.name }`,
				startTime,
				endTime,
				hintText: 'This is a rendering task',
				detailsPairs: [
					[ 'Item ID', item.id ],
					[ 'File name', item.file.name ],
					[ 'Image library', imageLibrary ],
					[ 'Input format', inputFormat ],
					[ 'Output format', outputFormat ],
					[ 'Output quality', outputQuality ],
				],
			};

			const timings = [ timing ];

			if ( args?.requireApproval ) {
				dispatch.finishOperation( id, {
					status: ItemStatus.PendingApproval,
					file,
					attachment: {
						url: blobUrl,
						mime_type: file.type,
					},
					timings,
				} );
			} else {
				dispatch.finishOperation( id, {
					file,
					attachment: {
						url: blobUrl,
					},
					timings,
				} );
			}
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'MEDIA_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		} finally {
			stop?.();
		}
	};
}

/**
 * Optimizes/Compresses an existing video item.
 *
 * @param id Item ID.
 */
export function optimizeVideoItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const outputFormat: VideoFormat =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'video_outputFormat' ) || 'mp4';

		const videoSizeThreshold: number = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'bigVideoSizeThreshold' );

		try {
			let file: File;
			const { transcodeVideo } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);

			switch ( outputFormat ) {
				case 'ogg':
					file = await transcodeVideo(
						item.file,
						getFileBasename( item.file.name ),
						'video/ogg',
						videoSizeThreshold
					);
					break;

				case 'mp4':
				case 'webm':
				default:
					file = await transcodeVideo(
						item.file,
						getFileBasename( item.file.name ),
						`video/${ outputFormat }`,
						videoSizeThreshold
					);
					break;
			}

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Mutes an existing video item.
 *
 * @param id Item ID.
 */
export function muteVideoItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const { muteVideo } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);
			const file = await muteVideo( item.file );

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
				additionalData: {
					mexp_is_muted: true,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'VIDEO_MUTING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Optimizes/Compresses an existing audio item.
 *
 * @param id Item ID.
 */
export function optimizeAudioItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const outputFormat: AudioFormat =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'audio_outputFormat' ) || 'mp3';

		try {
			let file: File;
			const { transcodeAudio } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);

			switch ( outputFormat ) {
				case 'ogg':
					file = await transcodeAudio(
						item.file,
						getFileBasename( item.file.name ),
						'audio/ogg'
					);
					break;

				case 'mp3':
				default:
					file = await transcodeAudio(
						item.file,
						getFileBasename( item.file.name ),
						'audio/mp3'
					);
					break;
			}

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'AUDIO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Converts an existing GIF item to a video.
 *
 * @param id Item ID.
 */
export function convertGifItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const outputFormat: VideoFormat =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'video_outputFormat' ) || 'video/mp4';

		const videoSizeThreshold: number = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'bigVideoSizeThreshold' );

		try {
			let file: File;
			const { convertGifToVideo } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);

			switch ( outputFormat ) {
				case 'ogg':
					file = await convertGifToVideo(
						item.file,
						getFileBasename( item.file.name ),
						'video/ogg',
						videoSizeThreshold
					);
					break;

				case 'mp4':
				case 'webm':
				default:
					file = await convertGifToVideo(
						item.file,
						getFileBasename( item.file.name ),
						`video/${ outputFormat }`,
						videoSizeThreshold
					);
					break;
			}

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Converts an existing HEIF image item to another format.
 *
 * @param id Item ID.
 */
export function convertHeifItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const file = await transcodeHeifImage( item.file );

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'IMAGE_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

type ResizeCropItemArgs = OperationArgs[ OperationType.ResizeCrop ];

/**
 * Resizes and crops an existing image item.
 *
 * @param id     Item ID.
 * @param [args] Additional arguments for the operation.
 */
export function resizeCropItem( id: QueueItemId, args?: ResizeCropItemArgs ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		if ( ! args?.resize ) {
			dispatch.finishOperation( id, {
				file: item.file,
			} );
			return;
		}

		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		const smartCrop = Boolean( thumbnailGeneration === 'smart' );

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		const addSuffix = Boolean( item.parentId );

		const stop = start(
			`Resize Item: ${ item.file.name } | ${ imageLibrary } | ${ thumbnailGeneration } | ${ args.resize.width }x${ args.resize.height }`
		);

		try {
			let file: File;

			// No browsers support GIF/AVIF in HTMLCanvasElement.toBlob().
			// Safari doesn't support WebP.
			// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
			if (
				'browser' === imageLibrary &&
				! [ 'image/gif', 'image/avif' ].includes( item.file.type ) &&
				! ( 'image/webp' === item.file.type && isSafari )
			) {
				file = await canvasResizeImage(
					item.file,
					args.resize,
					addSuffix
				);
			} else {
				file = await vipsResizeImage(
					item.id,
					item.file,
					args.resize,
					smartCrop,
					addSuffix
				);
			}

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'IMAGE_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		} finally {
			stop?.();
		}
	};
}

/**
 * Uploads an item to the server.
 *
 * @param id Item ID.
 */
export function uploadItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const startTime = performance.now();

		const { poster } = item;

		const additionalData: Record< string, unknown > = {
			...item.additionalData,
			// generatedPosterId is set when using muteExistingVideo() for example.
			meta: {
				mexp_generated_poster_id: item.generatedPosterId || undefined,
				mexp_original_id: item.sourceAttachmentId || undefined,
			},
			mexp_blurhash: item.blurHash,
			mexp_dominant_color: item.dominantColor,
			featured_media: item.generatedPosterId || undefined,
		};

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		let stillUrl = [ 'video', 'pdf' ].includes( mediaType )
			? item.attachment?.poster
			: item.attachment?.url;

		// Freshly converted GIF.
		if (
			! stillUrl &&
			'video' === mediaType &&
			'image' === getMediaTypeFromMimeType( item.sourceFile.type )
		) {
			stillUrl = createBlobURL( item.sourceFile );

			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl: stillUrl,
			} );
		}

		// TODO: Make this async after upload?
		// Could be made reusable to enable back-filling of existing blocks.
		if (
			typeof additionalData.mexp_is_muted === 'undefined' &&
			'video' === mediaType
		) {
			try {
				const hasAudio =
					item.attachment?.url &&
					( await videoHasAudio( item.attachment.url ) );
				additionalData.mexp_is_muted = ! hasAudio;
			} catch {
				// No big deal if this fails, we can still continue uploading.
			}
		}

		if (
			! additionalData.mexp_dominant_color &&
			stillUrl &&
			[ 'video', 'image', 'pdf' ].includes( mediaType )
		) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				additionalData.mexp_dominant_color =
					await dominantColorWorker.getDominantColor( stillUrl );
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if ( 'image' === mediaType && stillUrl && window.crossOriginIsolated ) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				additionalData.mexp_has_transparency =
					await vipsHasTransparency( stillUrl );
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if (
			! additionalData.mexp_blurhash &&
			stillUrl &&
			[ 'video', 'image', 'pdf' ].includes( mediaType )
		) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				additionalData.mexp_blurhash =
					await blurhashWorker.getBlurHash( stillUrl );
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		const timing: MeasureOptions = {
			measureName: `Upload item ${ item.file.name }`,
			startTime,
			endTime: performance.now(),
			hintText: 'This is a rendering task',
			detailsPairs: [
				[ 'Item ID', id ],
				[ 'File name', item.file.name ],
			],
		};

		const timings = [ timing ];

		select.getSettings().mediaUpload( {
			filesList: [ item.file ],
			additionalData,
			signal: item.abortController?.signal,
			onFileChange: ( [ attachment ] ) => {
				// TODO: Get the poster URL from the ID if one exists already.
				if ( 'video' === mediaType && ! attachment.featured_media ) {
					/*
					 The newly uploaded file won't have a poster yet.
					 However, we'll likely still have one on file.
					 Add it back so we're never without one.
					*/
					if ( item.attachment?.poster ) {
						attachment.poster = item.attachment.poster;
					} else if ( poster ) {
						attachment.poster = createBlobURL( poster );

						dispatch< CacheBlobUrlAction >( {
							type: Type.CacheBlobUrl,
							id,
							blobUrl: attachment.poster,
						} );
					}
				}

				dispatch.finishOperation( id, {
					attachment,
					timings,
				} );
			},
			onError: ( error ) => {
				dispatch.cancelItem( id, error );
			},
		} );
	};
}

/**
 * Sideloads an item to the server.
 *
 * @param id Item ID.
 */
export function sideloadItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const { post, ...additionalData } =
			item.additionalData as SideloadAdditionalData;

		select.getSettings().mediaSideload( {
			file: item.file,
			attachmentId: post as number,
			additionalData,
			signal: item.abortController?.signal,
			onFileChange: ( [ attachment ] ) => {
				dispatch.finishOperation( id, { attachment } );
				dispatch.resumeItem( post as number );
			},
			onError: ( error ) => {
				dispatch.cancelItem( id, error );
				dispatch.resumeItem( post as number );
			},
		} );
	};
}

type FetchRemoteFileArgs = OperationArgs[ OperationType.FetchRemoteFile ];

/**
 * Fetches a remote file from another server and adds it to the item.
 *
 * @param id   Item ID.
 * @param args Additional arguments for the operation.
 */
export function fetchRemoteFile( id: QueueItemId, args: FetchRemoteFileArgs ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const sourceFile = await fetchFile( args.url, args.fileName );

			if ( args.skipAttachment ) {
				dispatch.finishOperation( id, {
					sourceFile,
				} );
			} else {
				const file = args.newFileName
					? renameFile( cloneFile( sourceFile ), args.newFileName )
					: cloneFile( sourceFile );

				const blobUrl = createBlobURL( sourceFile );
				dispatch< CacheBlobUrlAction >( {
					type: Type.CacheBlobUrl,
					id,
					blobUrl,
				} );

				dispatch.finishOperation( id, {
					sourceFile,
					file,
					attachment: {
						url: blobUrl,
					},
				} );
			}
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'FETCH_REMOTE_FILE_ERROR',
							message: 'Remote file could not be downloaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Generates subtitles for the video item.
 *
 * @param id Item ID.
 */
export function generateSubtitles( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const { generateSubtitles: _generateSubtitles } = await import(
				/* webpackChunkName: 'subtitles' */ '@mexp/subtitles'
			);

			const file = await _generateSubtitles(
				item.sourceFile,
				getFileBasename( item.sourceFile.name )
			);

			const blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl,
			} );

			dispatch.finishOperation( id, {
				file,
				attachment: {
					url: blobUrl,
				},
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new MediaError( {
							code: 'FETCH_REMOTE_FILE_ERROR',
							message: 'Remote file could not be downloaded',
							file: item.file,
					  } )
			);
		}
	};
}

/**
 * Returns an action object that sets all image sub-sizes and their cropping information.
 *
 * @param imageSizes Map of image size names and their cropping information.
 *
 * @return Action object.
 */
export function setImageSizes(
	imageSizes: Record< string, ImageSizeCrop >
): SetImageSizesAction {
	return {
		type: Type.SetImageSizes,
		imageSizes,
	};
}

/**
 * Revokes all blob URLs for a given item, freeing up memory.
 *
 * @param id Item ID.
 */
export function revokeBlobUrls( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const blobUrls = select.getBlobUrls( id );

		for ( const blobUrl of blobUrls ) {
			revokeBlobURL( blobUrl );
		}

		dispatch< RevokeBlobUrlsAction >( {
			type: Type.RevokeBlobUrls,
			id,
		} );
	};
}
