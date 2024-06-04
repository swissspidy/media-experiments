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
	fetchRemoteFile,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	videoHasAudio,
} from '../utils';
import { sideloadFile, updateMediaItem, uploadToServer } from '../api';
import { PREFERENCES_NAME } from '../constants';
import { isHeifImage, transcodeHeifImage } from './utils/heif';
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
	CreateRestAttachment,
	ImageFormat,
	ImageLibrary,
	ImageSizeCrop,
	MediaSourceTerm,
	OnBatchSuccessHandler,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	OperationFinishAction,
	OperationStartAction,
	QueueItem,
	QueueItemId,
	RemoveAction,
	RequestApprovalAction,
	SetImageSizesAction,
	SetMediaSourceTermsAction,
	SideloadAdditionalData,
	ThumbnailGeneration,
	VideoFormat,
} from './types';
import { ItemStatus, OperationType, Type } from './types';

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
	requestApproval: typeof requestApproval;
	removeItem: typeof removeItem;
	addPosterForItem: typeof addPosterForItem;
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
	rejectApproval: typeof rejectApproval;
	grantApproval: typeof grantApproval;
	cancelItem: typeof cancelItem;
	generateThumbnails: typeof generateThumbnails;
	uploadOriginal: typeof uploadOriginal;
	uploadPoster: typeof uploadPoster;
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
	parentId?: QueueItemId;
	resize?: ImageSizeCrop;
	abortController?: AbortController;
}

export function addItem( {
	file,
	batchId,
	onChange,
	onSuccess,
	onBatchSuccess,
	onError,
	additionalData = {},
	sourceUrl,
	sourceAttachmentId,
	mediaSourceTerms = [],
	blurHash,
	dominantColor,
	abortController,
}: AddItemArgs ) {
	return async ( {
		dispatch,
		registry,
	}: {
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const imageSizeThreshold: number = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'bigImageSizeThreshold' );

		const resize = imageSizeThreshold
			? {
					width: imageSizeThreshold,
					height: imageSizeThreshold,
			  }
			: undefined;

		const thumbnailGeneration: ThumbnailGeneration = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'thumbnailGeneration' );

		const itemId = uuidv4();

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				batchId,
				status: ItemStatus.Processing,
				sourceFile: cloneFile( file ),
				file,
				attachment: {
					url: createBlobURL( file ),
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
				resize,
				abortController: abortController || new AbortController(),
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
			void dispatch.addItem( {
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
		const file = await fetchRemoteFile( url );

		dispatch.addItem( {
			file,
			onChange,
			onSuccess,
			onError,
			additionalData,
			sourceUrl: url,
			mediaSourceTerms: [ 'media-import' ],
		} );
	};
}

interface AddSideloadItemArgs {
	file: File;
	onChange?: OnChangeHandler;
	additionalData?: AdditionalData;
	resize?: ImageSizeCrop;
	operations?: OperationType[];
	batchId?: BatchId;
	parentId?: QueueItemId;
}

export function addSideloadItem( {
	file,
	onChange,
	additionalData,
	resize,
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
				resize,
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
	poster,
	onChange,
	onSuccess,
	onError,
	additionalData = {},
	blurHash,
	dominantColor,
	generatedPosterId,
}: MuteExistingVideoArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const fileName = getFileNameFromUrl( url );
		const baseName = getFileBasename( fileName );
		const sourceFile = await fetchRemoteFile( url, fileName );
		const file = new File(
			[ sourceFile ],
			sourceFile.name.replace( baseName, `${ baseName }-muted` ),
			{ type: sourceFile.type }
		);

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
				sourceFile,
				file,
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
				operations: [ OperationType.TranscodeMuteVideo ],
				generatedPosterId,
				abortController: new AbortController(),
			},
		} );

		void dispatch.prepareItem( itemId );
	};
}

interface AddSubtitlesForExistingVideoArgs {
	id?: number;
	url: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData: AdditionalData;
}

export function addSubtitlesForExistingVideo( {
	id,
	url,
	onChange,
	onSuccess,
	onError,
	additionalData,
}: AddSubtitlesForExistingVideoArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const fileName = getFileNameFromUrl( url );
		const sourceFile = await fetchRemoteFile( url, fileName );

		// TODO: Do this *after* adding to the queue so that we can disable the button quickly.
		// Plus, this way we can display proper error notice on failure.
		const { generateSubtitles } = await import(
			/* webpackChunkName: 'subtitles' */ '@mexp/subtitles'
		);
		const vttFile = await generateSubtitles( sourceFile );

		const itemId = uuidv4();

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: itemId,
				status: ItemStatus.Processing,
				sourceFile,
				file: vttFile,
				onChange,
				onSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				mediaSourceTerms: [ 'subtitles-generation' ],
				additionalData,
				abortController: new AbortController(),
			},
		} );

		void dispatch.prepareItem( itemId );
	};
}

interface OptimizexistingItemArgs {
	id: number;
	url: string;
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
	poster,
	batchId,
	onChange,
	onSuccess,
	onBatchSuccess,
	onError,
	additionalData = {},
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
		const fileName = getFileNameFromUrl( url );
		const baseName = getFileBasename( fileName );
		const sourceFile = await fetchRemoteFile( url, fileName );
		const file = new File(
			[ sourceFile ],
			sourceFile.name.replace( baseName, `${ baseName }-optimized` ),
			{ type: sourceFile.type }
		);

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
				sourceFile,
				file,
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
				operations: [ OperationType.TranscodeCompress ],
				generatedPosterId,
				abortController,
			},
		} );

		void dispatch.prepareItem( itemId );
	};
}

export function processItem( id: QueueItemId ) {
	return async ( { select, dispatch }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const { attachment, onChange, onSuccess, onBatchSuccess, batchId } =
			item;

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

		const nextOperation = item.operations?.[ 0 ];

		if ( ! nextOperation ) {
			if ( attachment ) {
				onSuccess?.( [ attachment ] );
			}
			if ( batchId && select.isBatchUploaded( batchId ) ) {
				onBatchSuccess?.();
			}
			void dispatch.removeItem( id );

			return;
		}

		dispatch< OperationStartAction >( {
			type: Type.OperationStart,
			id,
		} );

		switch ( nextOperation ) {
			case OperationType.TranscodeResizeCrop:
				void dispatch.resizeCropItem( item.id );
				break;

			case OperationType.TranscodeHeif:
				void dispatch.convertHeifItem( item.id );
				break;

			case OperationType.TranscodeGif:
				void dispatch.convertGifItem( item.id );
				break;

			case OperationType.TranscodeAudio:
				void dispatch.optimizeAudioItem( item.id );
				break;

			case OperationType.TranscodeVideo:
				void dispatch.optimizeVideoItem( item.id );
				break;

			case OperationType.TranscodeMuteVideo:
				void dispatch.muteVideoItem( item.id );
				break;

			case OperationType.TranscodeImage:
				void dispatch.optimizeImageItem( item.id );
				break;

			// TODO: Right now only handles images.
			case OperationType.TranscodeCompress:
				void dispatch.optimizeImageItem( item.id );
				break;

			case OperationType.AddPoster:
				void dispatch.addPosterForItem( item.id );
				break;

			case OperationType.Upload:
				if ( item.parentId ) {
					dispatch.sideloadItem( id );
				} else {
					dispatch.uploadItem( id );
				}
				break;

			case OperationType.ThumbnailGeneration:
				void dispatch.generateThumbnails( id );
				break;

			case OperationType.UploadOriginal:
				void dispatch.uploadOriginal( id );
				break;

			case OperationType.UploadPoster:
				void dispatch.uploadPoster( id );
				break;

			default:
			// This shouldn't happen.
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

export function requestApproval(
	id: QueueItemId,
	file: File
): RequestApprovalAction {
	return {
		type: Type.RequestApproval,
		id,
		file,
		url: createBlobURL( file ),
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

		const mediaType = getMediaTypeFromMimeType( file.type );

		switch ( mediaType ) {
			case 'video':
				const poster = await getPosterFromVideo(
					createBlobURL( file ),
					`${ getFileBasename( item.file.name ) }-poster`
				);

				dispatch.finishOperation( id, {
					poster,
					attachment: {
						poster: createBlobURL( file ),
					},
				} );

				break;

			case 'pdf':
				const { getImageFromPdf } = await import(
					/* webpackChunkName: 'pdf' */ '@mexp/pdf'
				);

				// TODO: is this the right place?
				// Note: Causes another state update.
				const pdfThumbnail = await getImageFromPdf(
					createBlobURL( file ),
					// Same suffix as WP core uses, see https://github.com/WordPress/wordpress-develop/blob/8a5daa6b446e8c70ba22d64820f6963f18d36e92/src/wp-admin/includes/image.php#L609-L634
					`${ getFileBasename( item.file.name ) }-pdf`
				);

				dispatch.finishOperation( id, {
					poster: pdfThumbnail,
					attachment: {
						poster: createBlobURL( pdfThumbnail ),
					},
				} );
				break;
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
			dispatch< AddOperationsAction >( {
				type: Type.AddOperations,
				id,
				operations: [ ...item.operations, OperationType.Upload ],
			} );

			dispatch.finishOperation( id, {} );
			return;
		}

		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const canTranscode = canTranscodeFile( file );

		const mediaType = getMediaTypeFromMimeType( file.type );

		const operations: OperationType[] = [];

		switch ( mediaType ) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				const isGif = isAnimatedGif( fileBuffer );

				const convertAnimatedGifs: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'gif_convert' );

				if ( isGif && canTranscode && convertAnimatedGifs ) {
					operations.push( OperationType.TranscodeGif );
					operations.push( OperationType.AddPoster );
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

				// Always add resize operation to comply with big image size threshold.
				operations.push( OperationType.TranscodeResizeCrop );

				const optimizeOnUpload: boolean = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'optimizeOnUpload' );

				if ( optimizeOnUpload ) {
					operations.push( OperationType.TranscodeImage );
				}

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

				break;

			case 'audio':
				if ( canTranscode ) {
					operations.push( OperationType.TranscodeAudio );
				}

				break;

			case 'pdf':
				operations.push( OperationType.AddPoster );

				break;
		}

		operations.push( OperationType.Upload );

		// Try poster generation again *after* upload if it's still mising
		if ( 'video' === mediaType ) {
			operations.push( OperationType.AddPoster );
			operations.push( OperationType.UploadPoster );
		}

		if ( 'image' === mediaType || 'pdf' === mediaType ) {
			operations.push( OperationType.ThumbnailGeneration );
		}

		if ( 'image' === mediaType ) {
			operations.push( OperationType.UploadOriginal );
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
	return async ( { select, dispatch }: ThunkArgs ) => {
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

				// Upload the "full" version without a resize param.
				void dispatch.addSideloadItem( {
					file: item.poster,
					additionalData: {
						// Sideloading does not use the parent post ID but the
						// attachment ID as the image sizes need to be added to it.
						post: attachment.id,
						image_size: 'full',
					},
					operations: [ OperationType.TranscodeImage ],
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

					void dispatch.addSideloadItem( {
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
						resize: imageSize,
						operations: [ OperationType.TranscodeResizeCrop ],
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
					// Allows skipping any resizing or optimization of the original image.
					operations: [],
				} );
			}
		}

		dispatch.finishOperation( id, {} );
	};
}

export function removeItem( id: QueueItemId ): RemoveAction {
	return {
		type: Type.Remove,
		id,
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

		dispatch.processItem( item.id );
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

		const imageLibrary: ImageLibrary =
			registry
				.select( preferencesStore )
				.get( PREFERENCES_NAME, 'imageLibrary' ) || 'vips';

		if ( 'vips' === imageLibrary ) {
			await vipsCancelOperations( id );
		}

		item.abortController?.abort();

		const { onError } = item;
		onError?.( error ?? new Error( 'Upload cancelled' ) );
		if ( ! onError && error ) {
			// TODO: Find better way to surface errors with sideloads etc.
			// eslint-disable-next-line no-console -- Deliberately log errors here.
			console.error( 'Upload cancelled', error );
		}

		dispatch( {
			type: Type.Cancel,
			id,
			error,
		} );
		void dispatch.removeItem( id );
	};
}

export function optimizeImageItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		const requireApproval = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'requireApproval' );

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

			// TODO: Use default_outputFormat if this is e.g. a PDF thumbnail.
			const outputFormat: ImageFormat =
				registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, `${ inputFormat }_outputFormat` ) ||
				inputFormat;

			// TODO: Pass quality to all the different encoders.
			const outputQuality: number =
				registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, `${ inputFormat }_quality` ) || 80;

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
							outputQuality / 100
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
						outputQuality / 100
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
							outputQuality / 100
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

			if ( requireApproval ) {
				dispatch.requestApproval( id, file );
			}

			dispatch.finishOperation( id, {
				file,
				mediaSourceTerms: [ 'media-optimization' ],
			} );
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

			dispatch.finishOperation( id, {
				file,
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

			dispatch.finishOperation( id, {
				file,
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

			dispatch.finishOperation( id, {
				file,
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

			dispatch.finishOperation( id, {
				file,
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
			dispatch.finishOperation( id, {
				file,
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

export function resizeCropItem( id: QueueItemId ) {
	return async ( { select, dispatch, registry }: ThunkArgs ) => {
		const item = select.getItem( id ) as QueueItem;

		if ( ! item.resize ) {
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
			`Resize Item: ${ item.file.name } | ${ imageLibrary } | ${ thumbnailGeneration } | ${ item.resize.width }x${ item.resize.height }`
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
					item.resize,
					addSuffix
				);
			} else {
				file = await vipsResizeImage(
					item.id,
					item.file,
					item.resize,
					smartCrop,
					addSuffix
				);
			}

			dispatch.finishOperation( id, {
				file,
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

		// Revoke blob URL created above.
		if ( stillUrl && isBlobURL( stillUrl ) ) {
			revokeBlobURL( stillUrl );
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

			void dispatch.finishOperation( id, { attachment } );
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
