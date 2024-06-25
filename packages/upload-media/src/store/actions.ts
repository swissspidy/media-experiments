import { v4 as uuidv4 } from 'uuid';
import { createWorkerFactory } from '@shopify/web-worker';

import { createBlobURL, isBlobURL, revokeBlobURL } from '@wordpress/blob';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

import {
	cloneFile,
	getExtensionFromMimeType,
	getFileBasename,
	getMediaTypeFromMimeType,
	ImageFile,
	renameFile,
} from '@mexp/media-utils';
import { start } from '@mexp/log';

import { UploadError } from '../uploadError';
import {
	canTranscodeFile,
	fetchFile,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	isHeifImage,
	videoHasAudio,
} from '../utils';
import { sideloadFile, updateMediaItem, uploadToServer } from '../api';
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
	CreateRestAttachment,
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	MediaSourceTerm,
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
	RemoveAction,
	RequestApprovalAction,
	ResumeItemAction,
	ResumeQueueAction,
	RevokeBlobUrlsAction,
	SetImageSizesAction,
	SetMediaSourceTermsAction,
	SideloadAdditionalData,
	ThumbnailGeneration,
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
type CurriedState< F > = F extends ( state: any, ...args: infer P ) => infer R
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
	file: File;
	batchId?: BatchId;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	onBatchSuccess?: OnBatchSuccessHandler;
	additionalData?: AdditionalData;
	sourceUrl?: string;
	sourceAttachmentId?: number;
	mediaSourceTerms?: MediaSourceTerm[];
	blurHash?: string;
	dominantColor?: string;
	abortController?: AbortController;
	operations?: Operation[];
}

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
	mediaSourceTerms = [],
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
				mediaSourceTerms,
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
			mediaSourceTerms: [ 'media-import' ],
			operations: [
				[ OperationType.FetchRemoteFile, { url, fileName } ],
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

		// TODO: Check canTranscodeFile(file) here to bail early? Or ideally already in the UI.

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
				mediaSourceTerms: [],
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
				mediaSourceTerms: [ 'subtitles-generation' ],
				additionalData,
				abortController: new AbortController(),
				operations: [
					[ OperationType.FetchRemoteFile, { url, fileName } ],
					OperationType.GenerateSubtitles,
					OperationType.Upload,
				],
			},
		} );

		dispatch.prepareItem( itemId );
	};
}

interface OptimizexistingItemArgs {
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
}

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
}: OptimizexistingItemArgs ) {
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
				onSuccess: async ( [ attachment ] ) => {
					onSuccess?.( [ attachment ] );
					// Update the original attachment in the DB to have
					// a reference to the optimized version.
					void updateMediaItem(
						id,
						{
							meta: {
								mexp_optimized_id: attachment.id,
							},
						},
						abortController.signal
					);
				},
				onBatchSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				mediaSourceTerms: [ 'media-optimization' ],
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
			},
		} );

		dispatch.prepareItem( itemId );
	};
}

export function processItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		if ( select.isPaused() ) {
			return;
		}

		const item = select.getItem( id ) as QueueItem;

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
				item.additionalData.post
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
			const { poster, ...media } = attachment;
			// Video block expects such a structure for the poster.
			// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
			if ( poster ) {
				media.image = {
					src: poster,
				};
			}

			onChange?.( [ media ] );
		}

		/*
		 If there are no more operations, the item can be removed from the queue,
		 but only if there are no thumbnails still being side-loaded,
		 or if itself is a side-loaded item.
		*/

		if ( ! item.operations || ! item.operations[ 0 ] ) {
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

				dispatch< RemoveAction >( {
					type: Type.Remove,
					id,
				} );
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

				dispatch< RemoveAction >( {
					type: Type.Remove,
					id: parentId,
				} );
				dispatch.revokeBlobUrls( parentId );
			}

			/*
			 At this point we are dealing with a parent whose children haven't fully uploaded yet.
			 Do nothing and let the removal happen once the last side-loaded item finishes.
			 */

			return;
		}

		dispatch< OperationStartAction >( {
			type: Type.OperationStart,
			id,
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

			default:
			// This shouldn't happen.
		}
	};
}

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

export function pauseQueue(): PauseQueueAction {
	return {
		type: Type.PauseQueue,
	};
}

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

export function addPosterForItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id ) as QueueItem;

		const { file } = item;

		// Bail early if the video already has a poster.
		if ( item.poster ) {
			dispatch.finishOperation( id, {} );
			return;
		}

		const mediaType = getMediaTypeFromMimeType( file.type );

		try {
			switch ( mediaType ) {
				case 'video':
					const src = createBlobURL( file );

					dispatch< CacheBlobUrlAction >( {
						type: Type.CacheBlobUrl,
						id,
						blobUrl: src,
					} );

					const poster = await getPosterFromVideo(
						src,
						`${ getFileBasename( item.file.name ) }-poster`
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

					const pdfSrc = createBlobURL( file );

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
			}
		} catch ( err ) {
			// Do not throw error. Could be a simple error such as video playback not working in tests.

			dispatch.finishOperation( id, {} );
		}
	};
}

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

		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const canTranscode = canTranscodeFile( file );

		const mediaType = getMediaTypeFromMimeType( file.type );

		const operations: Operation[] = [];

		switch ( mediaType ) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				const isGif = isAnimatedGif( fileBuffer );

				const convertAnimatedGifs: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'gif_convert' );

				if ( isGif && canTranscode && convertAnimatedGifs ) {
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

				const isHeif = await isHeifImage( fileBuffer );

				// TODO: Do we need a placeholder for a HEIF image?
				// Maybe a base64 encoded 1x1 gray PNG?
				// Use preloadImage() and getImageDimensions() so see if browser can render it.
				// Image/Video block already have a placeholder state.
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
					OperationType.ThumbnailGeneration,
					OperationType.UploadOriginal
				);

				break;

			case 'video':
				// Here we are potentially dealing with an unsupported file type (e.g. MOV)
				// that cannot be *played* by the browser, but could still be used for generating a poster.

				operations.push( OperationType.AddPoster );

				// TODO: First check if video already meets criteria, e.g. with mediainfo.js.
				// No need to compress a video that's already quite small.

				if ( canTranscode ) {
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
				if ( canTranscode ) {
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
					onSuccess: async ( [ posterAttachment ] ) => {
						// Similarly, update the original video in the DB to have the
						// poster as the featured image.
						// TODO: Do this server-side instead.
						void updateMediaItem(
							attachment.id,
							{
								featured_media: posterAttachment.id,
								meta: {
									mexp_generated_poster_id:
										posterAttachment.id,
								},
							},
							abortController.signal
						);
					},
					additionalData: {
						// Reminder: Parent post ID might not be set, depending on context,
						// but should be carried over if it does.
						post: item.additionalData.post,
					},
					mediaSourceTerms: [ 'poster-generation' ],
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
			attachment.missingImageSizes &&
			'server' !== thumbnailGeneration
		) {
			let file = attachment.fileName
				? renameFile( item.file, attachment.fileName )
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

			for ( const name of attachment.missingImageSizes ) {
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
export function uploadOriginal( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const attachment: Attachment = item.attachment as Attachment;

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		// Upload the original image file if it was resized because of the big image size threshold.

		if ( 'image' === mediaType ) {
			const keepOriginal: boolean = registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'keepOriginal' );

			if (
				! item.parentId &&
				item.file instanceof ImageFile &&
				item.file.wasResized &&
				keepOriginal
			) {
				const originalName = attachment.fileName || item.file.name;
				const originalBaseName = getFileBasename( originalName );

				// TODO: What if sourceFile is of type HEIC/HEIF?
				// Mime types of item.sourceFile and item.file are different.
				// Right now this triggers another HEIC conversion, which is not ideal.
				dispatch.addSideloadItem( {
					file: renameFile(
						item.sourceFile,
						originalName.replace(
							originalBaseName,
							`${ originalBaseName }-original`
						)
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
			} )
		);
	};
}

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

		dispatch.finishOperation( item.id, {
			mediaSourceTerms: [ 'media-optimization' ],
		} );
	};
}

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
		dispatch< RemoveAction >( {
			type: Type.Remove,
			id,
		} );
		dispatch.revokeBlobUrls( id );
	};
}

export function optimizeImageItem(
	id: QueueItemId,
	args?: OperationArgs[ OperationType.TranscodeImage ]
) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		let stop;

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

			if ( args?.requireApproval ) {
				dispatch< RequestApprovalAction >( {
					type: Type.RequestApproval,
					id,
					file,
					url: blobUrl,
				} );
			} else {
				dispatch.finishOperation( id, {
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
					: new UploadError( {
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
						'video/ogg',
						videoSizeThreshold
					);
					break;

				case 'mp4':
				case 'webm':
				default:
					file = await transcodeVideo(
						item.file,
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
				mediaSourceTerms: [ 'media-optimization' ],
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError( {
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

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
					: new UploadError( {
							code: 'VIDEO_MUTING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

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
					file = await transcodeAudio( item.file, 'audio/ogg' );
					break;

				case 'mp3':
				default:
					file = await transcodeAudio( item.file, 'audio/mp3' );
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
				mediaSourceTerms: [ 'media-optimization' ],
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError( {
							code: 'AUDIO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

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
						'video/ogg',
						videoSizeThreshold
					);
					break;

				case 'mp4':
				case 'webm':
				default:
					file = await convertGifToVideo(
						item.file,
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
				mediaSourceTerms: [ 'gif-conversion' ],
			} );
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError( {
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

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
					: new UploadError( {
							code: 'IMAGE_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } )
			);
		}
	};
}

export function resizeCropItem(
	id: QueueItemId,
	args?: OperationArgs[ OperationType.ResizeCrop ]
) {
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
					: new UploadError( {
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

export function uploadItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const { poster } = item;

		const additionalData: Partial< CreateRestAttachment > = {
			...item.additionalData,
			mexp_media_source: item.mediaSourceTerms
				?.map( ( slug ) => select.getMediaSourceTermId( slug ) )
				.filter( Boolean ) as number[],
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

		try {
			const attachment = await uploadToServer(
				item.file,
				additionalData,
				item.abortController?.signal
			);

			// TODO: Check if a poster happened to be generated on the server side already (check attachment.posterId !== 0).
			// In that case there is no need for client-side generation.
			// Instead, get the poster URL from the ID. Maybe async within the finishUploading() action?
			if ( 'video' === mediaType ) {
				// The newly uploaded file won't have a poster yet.
				// However, we'll likely still have one on file.
				// Add it back so we're never without one.
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
			} );
		} catch ( err ) {
			const error =
				err instanceof Error
					? err
					: new UploadError( {
							code: 'UNKNOWN_UPLOAD_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } );

			dispatch.cancelItem( id, error );
		}
	};
}

export function sideloadItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const { post, ...additionalData } =
			item.additionalData as SideloadAdditionalData;

		try {
			const attachment = await sideloadFile(
				item.file,
				post,
				additionalData,
				item.abortController?.signal
			);

			dispatch.finishOperation( id, { attachment } );
		} catch ( err ) {
			const error =
				err instanceof Error
					? err
					: new UploadError( {
							code: 'UNKNOWN_UPLOAD_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  } );

			dispatch.cancelItem( id, error );
		} finally {
			// Avoid race conditions by uploading items sequentially.
			dispatch.resumeItem( post );
		}
	};
}

export function fetchRemoteFile(
	id: QueueItemId,
	args: OperationArgs[ OperationType.FetchRemoteFile ]
) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const sourceFile = await fetchFile( args.url, args.fileName );

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
		} catch ( error ) {
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError( {
							code: 'FETCH_REMOTE_FILE_ERROR',
							message: 'Remote file could not be downloaded',
							file: item.file,
					  } )
			);
		}
	};
}

export function generateSubtitles( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		try {
			const { generateSubtitles: _generateSubtitles } = await import(
				/* webpackChunkName: 'subtitles' */ '@mexp/subtitles'
			);

			const file = await _generateSubtitles( item.sourceFile );

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
					: new UploadError( {
							code: 'FETCH_REMOTE_FILE_ERROR',
							message: 'Remote file could not be downloaded',
							file: item.file,
					  } )
			);
		}
	};
}

export function setMediaSourceTerms(
	terms: Record< string, number >
): SetMediaSourceTermsAction {
	return {
		type: Type.SetMediaSourceTerms,
		terms,
	};
}

export function setImageSizes(
	imageSizes: Record< string, ImageSizeCrop >
): SetImageSizesAction {
	return {
		type: Type.SetImageSizes,
		imageSizes,
	};
}

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
