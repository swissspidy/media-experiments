/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';
import { createWorkerFactory, type WorkerCreator } from '@shopify/web-worker';

/**
 * WordPress dependencies
 */
import { createBlobURL, isBlobURL, revokeBlobURL } from '@wordpress/blob';
import type { createRegistry } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import { measure, type MeasureOptions, start } from '@mexp/log';

/**
 * Internal dependencies
 */
import { ImageFile } from '../image-file';
import { UploadError } from '../upload-error';
import {
	canProcessWithFFmpeg,
	cloneFile,
	convertBlobToFile,
	fetchFile,
	getFileBasename,
	getFileExtension,
	getPosterFromVideo,
	isAnimatedGif,
	isHeifImage,
	isImageTypeSupported,
	renameFile,
	validateMimeType,
	videoHasAudio,
} from '../utils';
import { PREFERENCES_NAME } from '../constants';
import { StubFile } from '../stub-file';
import { transcodeHeifImage } from './utils/heif';
import {
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
	Attachment,
	AudioFormat,
	BatchId,
	CacheBlobUrlAction,
	ImageFormat,
	ImageLibrary,
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
	Settings,
	UpdateSettingsAction,
	SideloadAdditionalData,
	State,
	ThumbnailGeneration,
	VideoFormat,
} from './types';
import { ItemStatus, OperationType, Type } from './types';
import type { cancelItem } from './actions';

type WPDataRegistry = ReturnType< typeof createRegistry >;

let dominantColorWorker:
	| ReturnType< WorkerCreator< typeof import('./workers/dominant-color') > >
	| undefined;

function getDominantColorWorker() {
	if ( dominantColorWorker !== undefined ) {
		return dominantColorWorker;
	}

	const createWorker = createWorkerFactory(
		() =>
			import(
				/* webpackChunkName: 'dominant-color' */ './workers/dominant-color'
			)
	);
	dominantColorWorker = createWorker();

	return dominantColorWorker;
}

let blurhashWorker:
	| ReturnType< WorkerCreator< typeof import('./workers/blurhash') > >
	| undefined;

function getBlurhashWorker() {
	if ( blurhashWorker !== undefined ) {
		return blurhashWorker;
	}

	const createWorker = createWorkerFactory(
		() => import( /* webpackChunkName: 'blurhash' */ './workers/blurhash' )
	);
	blurhashWorker = createWorker();

	return blurhashWorker;
}

let aiWorker:
	| ReturnType< WorkerCreator< typeof import('@mexp/ai') > >
	| undefined;

function getAiWorker() {
	if ( aiWorker !== undefined ) {
		return aiWorker;
	}

	const createWorker = createWorkerFactory(
		() => import( /* webpackChunkName: 'ai' */ '@mexp/ai' )
	);
	aiWorker = createWorker();

	return aiWorker;
}

// Safari does not currently support WebP in HTMLCanvasElement.toBlob()
// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
const isSafari = Boolean(
	window?.navigator.userAgent &&
		window.navigator.userAgent.includes( 'Safari' ) &&
		! window.navigator.userAgent.includes( 'Chrome' ) &&
		! window.navigator.userAgent.includes( 'Chromium' )
);

type ActionCreators = {
	cancelItem: typeof cancelItem;
	addItem: typeof addItem;
	addSideloadItem: typeof addSideloadItem;
	removeItem: typeof removeItem;
	prepareItem: typeof prepareItem;
	processItem: typeof processItem;
	finishOperation: typeof finishOperation;
	uploadItem: typeof uploadItem;
	sideloadItem: typeof sideloadItem;
	resumeItem: typeof resumeItem;
	addPosterForItem: typeof addPosterForItem;
	muteVideoItem: typeof muteVideoItem;
	convertHeifItem: typeof convertHeifItem;
	resizeCropItem: typeof resizeCropItem;
	convertGifItem: typeof convertGifItem;
	optimizeVideoItem: typeof optimizeVideoItem;
	optimizeAudioItem: typeof optimizeAudioItem;
	optimizeImageItem: typeof optimizeImageItem;
	generateThumbnails: typeof generateThumbnails;
	uploadOriginal: typeof uploadOriginal;
	uploadPoster: typeof uploadPoster;
	revokeBlobUrls: typeof revokeBlobUrls;
	fetchRemoteFile: typeof fetchRemoteFile;
	generateVideoSubtitles: typeof generateVideoSubtitles;
	generateImageCaptions: typeof generateImageCaptions;
	generateMetadata: typeof generateMetadata;
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

interface AddItemArgs {
	// It should always be a File, but some consumers might still pass Blobs only.
	file: File | Blob;
	batchId?: BatchId;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	additionalData?: AdditionalData;
	sourceUrl?: string;
	sourceAttachmentId?: number;
	abortController?: AbortController;
	operations?: Operation[];
}

/**
 * Adds a new item to the upload queue.
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
 * @param [$0.abortController]    Abort controller for upload cancellation.
 * @param [$0.operations]         List of operations to perform. Defaults to automatically determined list, based on the file.
 */
export function addItem( {
	file: fileOrBlob,
	batchId,
	onChange,
	onSuccess,
	onBatchSuccess,
	onError,
	additionalData = {} as AdditionalData,
	sourceUrl,
	sourceAttachmentId,
	abortController,
	operations,
}: AddItemArgs ) {
	return async ( { dispatch, registry }: ThunkArgs ) => {
		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		const itemId = uuidv4();

		// Hardening in case a Blob is passed instead of a File.
		// See https://github.com/WordPress/gutenberg/pull/65693 for an example.
		const file = convertBlobToFile( fileOrBlob );

		let blobUrl;

		// StubFile could be coming from addItemFromUrl().
		if ( ! ( file instanceof StubFile ) ) {
			blobUrl = createBlobURL( file );
			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id: itemId,
				blobUrl,
			} );
		}

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
					convert_format: false,
					...additionalData,
				},
				onChange,
				onSuccess,
				onBatchSuccess,
				onError,
				sourceUrl,
				sourceAttachmentId,
				abortController: abortController || new AbortController(),
				operations: Array.isArray( operations )
					? operations
					: [ OperationType.Prepare ],
			},
		} );

		dispatch.processItem( itemId );
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
	return async ( { dispatch }: ThunkArgs ) => {
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
					...additionalData,
				},
				parentId,
				operations: Array.isArray( operations )
					? operations
					: [ OperationType.Prepare ],
				abortController: new AbortController(),
			},
		} );

		dispatch.processItem( itemId );
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
			if (
				parentId ||
				( ! parentId && ! select.isUploadingByParentId( id ) )
			) {
				if ( attachment ) {
					onSuccess?.( [ attachment ] );
				}

				dispatch.removeItem( id );
				dispatch.revokeBlobUrls( id );

				if ( batchId && select.isBatchUploaded( batchId ) ) {
					onBatchSuccess?.();
				}
			}

			// All other side-loaded items have been removed, so remove the parent too.
			if ( parentId && batchId && select.isBatchUploaded( batchId ) ) {
				const parentItem = select.getItem( parentId ) as QueueItem;

				if ( attachment ) {
					parentItem.onSuccess?.( [ attachment ] );
				}

				dispatch.removeItem( parentId );
				dispatch.revokeBlobUrls( parentId );

				if (
					parentItem.batchId &&
					select.isBatchUploaded( parentItem.batchId )
				) {
					parentItem.onBatchSuccess?.();
				}
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
			case OperationType.Prepare:
				dispatch.prepareItem( item.id );
				break;

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
				dispatch.optimizeVideoItem(
					item.id,
					operationArgs as OperationArgs[ OperationType.TranscodeVideo ]
				);
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

			case OperationType.GenerateMetadata:
				dispatch.generateMetadata( item.id );
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
				dispatch.uploadOriginal(
					id,
					operationArgs as OperationArgs[ OperationType.UploadOriginal ]
				);
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
				dispatch.generateVideoSubtitles( id );
				break;

			case OperationType.GenerateCaptions:
				dispatch.generateImageCaptions( id );
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

		for ( const item of select.getAllItems() ) {
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
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		// Bail early if the video already has a poster.
		if ( item.poster ) {
			dispatch.finishOperation( id, {} );
			return;
		}

		try {
			if ( item.file.type.startsWith( 'video/' ) ) {
				let src = isBlobURL( item.attachment?.url )
					? item.attachment?.url
					: undefined;

				if ( ! src ) {
					src = createBlobURL( item.file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: src,
					} );
				}

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
						url: item.attachment?.url || src,
						poster: posterUrl,
					},
				} );
			} else if ( 'application/pdf' === item.file.type ) {
				const { getImageFromPdf } = await import(
					/* webpackChunkName: 'pdf' */ '@mexp/pdf'
				);

				let pdfSrc = item.attachment?.url;

				if ( ! pdfSrc ) {
					pdfSrc = createBlobURL( item.file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: pdfSrc,
					} );
				}

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
			} else {
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
		} catch {
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

		const mediaType =
			'application/pdf' === file.type
				? 'pdf'
				: file.type.split( '/' )[ 0 ];

		const outputFormat: ImageFormat = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'default_outputFormat' );

		const outputQuality: number = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'default_quality' );

		const interlaced: boolean = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'default_interlaced' );

		const operations: Operation[] = [];

		switch ( mediaType ) {
			case 'image':
				// Short-circuit for file types such as SVG or ICO.
				if ( ! isImageTypeSupported( file.type ) ) {
					operations.push( OperationType.Upload );
					break;
				}

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
						OperationType.GenerateMetadata,
						OperationType.Upload,
						// Try poster generation again *after* upload if it's still missing.
						OperationType.AddPoster,
						OperationType.UploadPoster
					);

					break;
				}

				let optimizeOnUpload: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'optimizeOnUpload' );

				const convertUnsafe: boolean | undefined = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'convertUnsafe' );
				const isHeif = isHeifImage( fileBuffer );
				const isWebSafe =
					item.file.type.startsWith( 'image/' ) &&
					[
						'image/png',
						'image/gif',
						'image/jpeg',
						'image/webp',
						'image/avif',
					].includes( item.file.type );

				let uploadOriginalImage = false;

				if ( convertUnsafe ) {
					if ( isHeif ) {
						operations.push( OperationType.TranscodeHeif );
						uploadOriginalImage = true;
					} else if ( ! isWebSafe ) {
						operations.push( [
							OperationType.TranscodeImage,
							{
								outputFormat,
								outputQuality,
								interlaced,
							},
						] );
						uploadOriginalImage = true;
						optimizeOnUpload = false;
					}
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

				if ( optimizeOnUpload ) {
					operations.push( OperationType.TranscodeImage );
				}

				operations.push( OperationType.GenerateMetadata );

				const useAi: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'useAi' );

				if ( useAi ) {
					operations.push( OperationType.GenerateCaptions );
				}

				operations.push(
					OperationType.Upload,
					OperationType.ThumbnailGeneration
				);

				const keepOriginal: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'keepOriginal' );

				if (
					( imageSizeThreshold && keepOriginal ) ||
					uploadOriginalImage
				) {
					operations.push( [
						OperationType.UploadOriginal,
						{ force: uploadOriginalImage },
					] );
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
					operations.push( [
						OperationType.TranscodeVideo,
						// Don't make a fuzz if video cannot be transcoded.
						{ continueOnError: true },
					] );
				}

				operations.push(
					OperationType.GenerateMetadata,
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
					OperationType.GenerateMetadata,
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

		dispatch.finishOperation( id, {} );
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
					OperationType.ThumbnailGeneration
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

						// TODO: Pass poster ID as well so that the video block can update `featured_media` via the REST API.
						const updatedAttachment = {
							...attachment,
							// Video block expects such a structure for the poster.
							// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
							image: {
								src: posterAttachment.url,
							},
							// Expected by ImportMedia / addItemFromUrl()
							poster: posterAttachment.url,
						};

						// This might be confusing, but the idea is to update the original
						// video item in the editor with the newly uploaded poster.
						item.onChange?.( [ updatedAttachment ] );
					},
					additionalData: {
						// Reminder: Parent post ID might not be set, depending on context,
						// but should be carried over if it does.
						post: item.additionalData.post,
						mexp_blurash: item.additionalData.mexp_blurhash,
						mexp_dominant_color:
							item.additionalData.mexp_dominant_color,
					},
					abortController,
					operations,
				} );
			} catch {
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

			if ( 'application/pdf' === item.file.type && item.poster ) {
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
						convert_format: false,
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
				if ( ! imageSize ) {
					continue;
				}

				// Force thumbnails to be soft crops, see wp_generate_attachment_metadata().
				if (
					'application/pdf' === item.file.type &&
					'thumbnail' === name
				) {
					imageSize.crop = false;
				}

				dispatch.addSideloadItem( {
					file,
					onChange: ( [ updatedAttachment ] ) => {
						// If the sub-size is still being generated, there is no need
						// to invoke the callback below. It would just override
						// the main image in the editor with the sub-size.
						if ( isBlobURL( updatedAttachment.url ) ) {
							return;
						}

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
						convert_format: false,
					},
					operations: [
						[ OperationType.ResizeCrop, { resize: imageSize } ],
						OperationType.Upload,
					],
				} );
			}
		}

		dispatch.finishOperation( id, {} );
	};
}

type UploadOriginalArgs = OperationArgs[ OperationType.UploadOriginal ];

/**
 * Adds the original file to the queue for sideloading.
 *
 * If an item was downsized due to the big image size threshold,
 * this adds the original file for storing.
 *
 * @param id     Item ID.
 * @param [args] Additional arguments for the operation.
 */
export function uploadOriginal( id: QueueItemId, args?: UploadOriginalArgs ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const attachment: Attachment = item.attachment as Attachment;

		/*
		 Upload the original image file if it was resized because of the big image size threshold,
		 or if it was converted to be web-safe (e.g. HEIC, JPEG XL) and thus
		 uploading the original is "forced".
		*/
		if (
			! item.parentId &&
			( ( item.file instanceof ImageFile && item.file?.wasResized ) ||
				args?.force )
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
					convert_format: false,
				},
				// Skip any resizing or optimization of the original image.
				operations: [ OperationType.Upload ],
			} );
		}

		dispatch.finishOperation( id, {} );
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

		const inputFormat = item.file.type.split( '/' )[ 1 ];

		let stop: undefined | ( () => void );

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

		let imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		if (
			! [ 'png', 'jpeg', 'webp' ].includes( inputFormat ) ||
			! [ 'png', 'jpeg', 'webp' ].includes( inputFormat )
		) {
			imageLibrary = 'vips';
		}

		// Safari doesn't support WebP in HTMLCanvasElement.toBlob().
		// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
		if (
			isSafari &&
			( 'webp' === inputFormat || 'webp' === outputFormat )
		) {
			imageLibrary = 'vips';
		}

		try {
			let file: File;

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
					if ( 'browser' === imageLibrary ) {
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
						'image/gif',
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
				tooltipText: 'This is a rendering task',
				properties: [
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
				new UploadError( {
					code: 'MEDIA_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
				} )
			);
		} finally {
			stop?.();
		}
	};
}

type OptimizeVideoItemArgs = OperationArgs[ OperationType.TranscodeVideo ];

/**
 * Optimizes/Compresses an existing video item.
 *
 * @param id     Item ID.
 * @param [args] Additional arguments for the operation.
 */
export function optimizeVideoItem(
	id: QueueItemId,
	args?: OptimizeVideoItemArgs
) {
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
			const { transcodeVideo } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);

			const file = await transcodeVideo(
				item.file,
				getFileBasename( item.file.name ),
				`video/${ outputFormat }`,
				videoSizeThreshold
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
			const isChunkLoadError =
				error instanceof Error && error.name === 'ChunkLoadError';
			if ( isChunkLoadError ) {
				// eslint-disable-next-line no-console -- Deliberately log errors here.
				console.error( error );
			}

			if ( args?.continueOnError && ! isChunkLoadError ) {
				dispatch.finishOperation( id, {} );
				return;
			}

			dispatch.cancelItem(
				id,
				new UploadError( {
					code: 'VIDEO_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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
				new UploadError( {
					code: 'VIDEO_MUTING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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
				new UploadError( {
					code: 'AUDIO_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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
			const { convertGifToVideo } = await import(
				/* webpackChunkName: 'ffmpeg' */ '@mexp/ffmpeg'
			);

			const file = await convertGifToVideo(
				item.file,
				getFileBasename( item.file.name ),
				`video/${ outputFormat }`,
				videoSizeThreshold
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
			if ( error instanceof Error && error.name === 'ChunkLoadError' ) {
				// eslint-disable-next-line no-console -- Deliberately log errors here.
				console.error( error );
			}
			dispatch.cancelItem(
				id,
				new UploadError( {
					code: 'VIDEO_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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
				new UploadError( {
					code: 'IMAGE_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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
				new UploadError( {
					code: 'IMAGE_TRANSCODING_ERROR',
					message: 'File could not be uploaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
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

		const timing: MeasureOptions = {
			measureName: `Upload item ${ item.file.name }`,
			startTime,
			endTime: performance.now(),
			tooltipText: 'This is a rendering task',
			properties: [
				[ 'Item ID', id ],
				[ 'File name', item.file.name ],
			],
		};

		const timings = [ timing ];

		select.getSettings().mediaUpload( {
			filesList: [ item.file ],
			additionalData: item.additionalData,
			signal: item.abortController?.signal,
			onFileChange: ( [ attachment ] ) => {
				// TODO: Get the poster URL from the ID if one exists already.
				if (
					item.file.type.startsWith( 'video/' ) &&
					! attachment.featured_media
				) {
					/*
					 The newly uploaded file won't have a poster yet.
					 However, we'll likely still have one on file.
					 Add it back so we're never without one.
					*/
					if ( item.attachment?.poster ) {
						attachment.poster = item.attachment.poster;
					} else if ( item.poster ) {
						attachment.poster = createBlobURL( item.poster );

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
 * @param id     Item ID.
 * @param [args] Additional arguments for the operation.
 */
export function fetchRemoteFile( id: QueueItemId, args: FetchRemoteFileArgs ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const sourceFile = await fetchFile( args.url, args.fileName );

			validateMimeType( sourceFile, args.allowedTypes );

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
				new UploadError( {
					code: 'FETCH_REMOTE_FILE_ERROR',
					message: 'Remote file could not be downloaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
				} )
			);
		}
	};
}

/**
 * Generates subtitles for a video.
 *
 * @param id Item ID.
 */
export function generateVideoSubtitles( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			/*
			 Cannot load this in a dedicated worker, as AudioContext and
			 AudioBuffer are not available in a worker context.
			*/
			const { generateSubtitles } = await import(
				/* webpackChunkName: 'subtitles' */ '../generate-subtitles'
			);

			const file = await generateSubtitles(
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
				new UploadError( {
					code: 'FETCH_REMOTE_FILE_ERROR',
					message: 'Remote file could not be downloaded',
					file: item.file,
					cause: error instanceof Error ? error : undefined,
				} )
			);
		}
	};
}

/**
 * Generates captions and alternative text for an image.
 *
 * @param id Item ID.
 */
export function generateImageCaptions( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		// Item already has both caption and alt text, do nothing.
		if ( item.additionalData?.caption && item.additionalData.alt_text ) {
			dispatch.finishOperation( id, {} );
			return;
		}

		try {
			let url = item.attachment?.url;

			if ( ! url ) {
				url = createBlobURL( item.file );

				dispatch< CacheBlobUrlAction >( {
					type: Type.CacheBlobUrl,
					id,
					blobUrl: url,
				} );
			}

			// Do not override existing caption or alt text.
			const caption =
				item.additionalData?.caption ||
				( await getAiWorker().generateCaption( url ) );

			const alt =
				item.additionalData?.alt_text ||
				( await getAiWorker().generateCaption(
					url,
					'<DETAILED_CAPTION>'
				) );

			dispatch.finishOperation( id, {
				// For updating in the editor straight away.
				attachment: {
					caption,
					alt,
				},
				// For sending to the server.
				additionalData: {
					caption,
					alt_text: alt,
				},
			} );
		} catch {
			// No big deal if captions could not be generated, just proceed normally.
			dispatch.finishOperation( id, {} );
		}
	};
}

/**
 * Generates additional metadata like the dominant color for every item.
 *
 * @param id Item ID.
 */
export function generateMetadata( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const additionalData: AdditionalData = {};

		if (
			typeof additionalData.mexp_is_muted === 'undefined' &&
			item.file.type.startsWith( 'video/' )
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

		// TODO: Create a scaled-down version of the image first for performance reasons.
		let stillUrl =
			'application/pdf' === item.file.type ||
			item.file.type.startsWith( 'video/' )
				? item.attachment?.poster
				: item.attachment?.url;

		// Freshly converted GIF.
		if (
			! stillUrl &&
			item.file.type.startsWith( 'video/' ) &&
			item.sourceFile.type.startsWith( 'image/' )
		) {
			stillUrl = createBlobURL( item.sourceFile );

			dispatch< CacheBlobUrlAction >( {
				type: Type.CacheBlobUrl,
				id,
				blobUrl: stillUrl,
			} );
		}

		if (
			! additionalData.mexp_dominant_color &&
			stillUrl &&
			( item.file.type.startsWith( 'video/' ) ||
				item.file.type.startsWith( 'image/' ) ||
				'application/pdf' === item.file.type )
		) {
			try {
				additionalData.mexp_dominant_color =
					await getDominantColorWorker().getDominantColor( stillUrl );
			} catch {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if (
			item.file.type.startsWith( 'image/' ) &&
			stillUrl &&
			window.crossOriginIsolated
		) {
			try {
				additionalData.mexp_has_transparency =
					await vipsHasTransparency( stillUrl );
			} catch {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if (
			! additionalData.mexp_blurhash &&
			stillUrl &&
			( item.file.type.startsWith( 'video/' ) ||
				item.file.type.startsWith( 'image/' ) ||
				'application/pdf' === item.file.type )
		) {
			try {
				additionalData.mexp_blurhash =
					await getBlurhashWorker().getBlurHash( stillUrl );
			} catch {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		dispatch.finishOperation( id, {
			additionalData,
		} );
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
