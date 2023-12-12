import { v4 as uuidv4 } from 'uuid';
import { createWorkerFactory } from '@shopify/web-worker';

import { createBlobURL, isBlobURL, revokeBlobURL } from '@wordpress/blob';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

import {
	convertGifToVideo,
	convertImageToWebP,
	muteVideo,
	transcodeAudio,
	transcodeVideo,
} from '@mexp/ffmpeg';
import { convertImageToJpeg, resizeImage } from '@mexp/vips';
import { isHeifImage, transcodeHeifImage } from '@mexp/heif';
import { getImageFromPdf } from '@mexp/pdf';
import { generateSubtitles } from '@mexp/subtitles';
import {
	convertImageToAvif,
	convertImageToJpeg as convertImageToMozJpeg,
} from '@mexp/jsquash';
import { getFileBasename, getMediaTypeFromMimeType } from '@mexp/media-utils';

import { UploadError } from '../uploadError';
import {
	canTranscodeFile,
	convertImageFormat,
	fetchRemoteFile,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	videoHasAudio,
} from '../utils';
import { sideloadFile, updateMediaItem, uploadToServer } from '../api';
import { PREFERENCES_NAME } from '../constants';
import type {
	AddAction,
	AdditionalData,
	AddPosterAction,
	ApproveUploadAction,
	Attachment,
	BatchId,
	CancelAction,
	ImageFormat,
	ImageSizeCrop,
	MediaSourceTerm,
	OnBatchSuccessHandler,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	PrepareAction,
	QueueItem,
	QueueItemId,
	RemoveAction,
	RequestApprovalAction,
	SetImageSizesAction,
	SetMediaSourceTermsAction,
	SideloadFinishAction,
	TranscodingFinishAction,
	TranscodingPrepareAction,
	TranscodingStartAction,
	UploadFinishAction,
	UploadStartAction,
} from './types';
import { ItemStatus, TranscodingType, Type } from './types';

const createDominantColorWorker = createWorkerFactory(
	() =>
		import(
			/* webpackChunkName: 'dominant-color-worker' */ '../workers/dominantColor.worker'
		)
);
const dominantColorWorker = createDominantColorWorker();

const createBlurhashWorker = createWorkerFactory(
	() =>
		import(
			/* webpackChunkName: 'blurhash-worker' */ '../workers/blurhash.worker'
		)
);
const blurhashWorker = createBlurhashWorker();

type ActionCreators = {
	uploadItem: typeof uploadItem;
	sideloadItem: typeof sideloadItem;
	addItem: typeof addItem;
	addSideloadItem: typeof addSideloadItem;
	removeItem: typeof removeItem;
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
	requestApproval: typeof requestApproval;
	rejectApproval: typeof rejectApproval;
	grantApproval: typeof grantApproval;
	prepareForTranscoding: typeof prepareForTranscoding;
	startTranscoding: typeof startTranscoding;
	finishTranscoding: typeof finishTranscoding;
	startUploading: typeof startUploading;
	finishUploading: typeof finishUploading;
	finishSideloading: typeof finishSideloading;
	cancelItem: typeof cancelItem;
	uploadPosterForItem: typeof uploadPosterForItem;
	addPoster: typeof addPoster;
	< T = Record< string, unknown > >( args: T ): void;
};

type AllSelectors = typeof import('./selectors');
type CurriedState< F > = F extends ( state: any, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
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
	isSideload?: boolean;
	resize?: ImageSizeCrop;
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
}: AddItemArgs ) {
	return async ( {
		dispatch,
		registry,
	}: {
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const imageSizeThreshold = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'bigImageSizeThreshold' );

		const resize = imageSizeThreshold
			? {
					width: imageSizeThreshold,
					height: 0,
			  }
			: undefined;

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: uuidv4(),
				batchId,
				status: ItemStatus.Pending,
				sourceFile: new File( [ file ], file.name, {
					type: file.type,
					lastModified: file.lastModified,
				} ),
				file,
				attachment: {
					url: createBlobURL( file ),
				},
				additionalData: {
					// TODO: Make configurable via preferences?
					generate_sub_sizes: false,
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
			},
		} );
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
	additionalData?: AdditionalData;
	resize?: ImageSizeCrop;
	transcode?: TranscodingType[];
	batchId?: BatchId;
}

export function addSideloadItem( {
	file,
	additionalData,
	resize,
	transcode,
	batchId,
}: AddSideloadItemArgs ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: uuidv4(),
				batchId,
				status: ItemStatus.Pending,
				sourceFile: new File( [ file ], file.name, {
					type: file.type,
					lastModified: file.lastModified,
				} ),
				file,
				additionalData: {
					generate_sub_sizes: false,
					...additionalData,
				},
				isSideload: true,
				resize,
				transcode,
			},
		} );
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

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: uuidv4(),
				status: ItemStatus.Pending,
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
				transcode: [ TranscodingType.MuteVideo ],
				generatedPosterId,
			},
		} );
	};
}

interface AddSubtitlesForExistingVideoArgs {
	id: number;
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
		const vttFile = await generateSubtitles( sourceFile );

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: uuidv4(),
				status: ItemStatus.Pending,
				sourceFile,
				file: vttFile,
				onChange,
				onSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				mediaSourceTerms: [ 'subtitles-generation' ],
				additionalData,
			},
		} );
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
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const fileName = getFileNameFromUrl( url );
		const baseName = getFileBasename( fileName );
		const sourceFile = await fetchRemoteFile( url, fileName );
		const file = new File(
			[ sourceFile ],
			sourceFile.name.replace( baseName, `${ baseName }-optimized` ),
			{ type: sourceFile.type }
		);

		// TODO: Same considerations apply as for muteExistingVideo.

		dispatch< AddAction >( {
			type: Type.Add,
			item: {
				id: uuidv4(),
				batchId,
				status: ItemStatus.Pending,
				sourceFile,
				file,
				attachment: {
					url,
					poster,
				},
				additionalData: {
					generate_sub_sizes: false,
					...additionalData,
				},
				onChange,
				onSuccess: async ( [ attachment ] ) => {
					onSuccess?.( [ attachment ] );
					// Update the original attachment in the DB to have
					// a reference to the optimized version.
					void updateMediaItem( id, {
						meta: {
							mexp_optimized_id: attachment.id,
						},
					} );
				},
				onBatchSuccess,
				onError,
				sourceUrl: url,
				sourceAttachmentId: id,
				mediaSourceTerms: [ 'media-optimization' ],
				blurHash,
				dominantColor,
				transcode: [ TranscodingType.OptimizeExisting ],
				generatedPosterId,
			},
		} );
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

export function prepareItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
		registry,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		const { file } = item;

		dispatch< PrepareAction >( {
			type: Type.Prepare,
			id,
		} );

		// Transcoding type has already been set, e.g. via muteExistingVideo() or addSideloadItem().
		// TODO: Check canTranscode either here, in muteExistingVideo, or in the UI.
		if ( item.transcode ) {
			dispatch.prepareForTranscoding( id );
			return;
		}

		const mediaType = getMediaTypeFromMimeType( file.type );
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const canTranscode = canTranscodeFile( file );

		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const imageQuality = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'imageQuality' );

		switch ( mediaType ) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				// TODO: Here we could convert all images to WebP/AVIF/xyz by default.
				// Depends on the user settings of course.

				// TODO: Enforce big image size threshold.
				// Might need to get dimensions first?

				const isHeif = isHeifImage( fileBuffer );
				const isGif = isAnimatedGif( fileBuffer );

				if ( isHeif ) {
					// TODO: Do we need a placeholder for a HEIF image?
					// Maybe a base64 encoded 1x1 gray PNG?
					// Use preloadImage() and getImageDimensions() so see if browser can render it.
					// Image/Video block already have a placeholder state.
					dispatch.prepareForTranscoding( id, [
						TranscodingType.Heif,
						TranscodingType.Image,
					] );
					return;
				}

				if ( isGif && canTranscode ) {
					dispatch.prepareForTranscoding( id, [
						TranscodingType.Gif,
					] );
					return;
				}

				break;

			case 'video':
				// Here we are potentially dealing with an unsupported file type (e.g. MOV)
				// that cannot be *played* by the browser, but could still be used for generating a poster.

				try {
					// TODO: is this the right place?
					// Note: Causes another state update.
					const poster = await getPosterFromVideo(
						createBlobURL( file ),
						`${ getFileBasename( item.file.name ) }-poster`,
						imageQuality
					);
					dispatch.addPoster( id, poster );
				} catch {
					// Do nothing for now.
				}

				// TODO: First check if video already meets criteria, e.g. with mediainfo.js.
				// No need to compress a video that's already quite small.

				if ( canTranscode ) {
					dispatch.prepareForTranscoding( id, [
						TranscodingType.Video,
					] );
					return;
				}

				break;

			case 'audio':
				if ( canTranscode ) {
					dispatch.prepareForTranscoding( id, [
						TranscodingType.Audio,
					] );
					return;
				}

				break;

			case 'pdf':
				// TODO: is this the right place?
				// Note: Causes another state update.
				const pdfThumbnail = await getImageFromPdf(
					createBlobURL( file ),
					// Same suffix as WP core uses, see https://github.com/WordPress/wordpress-develop/blob/8a5daa6b446e8c70ba22d64820f6963f18d36e92/src/wp-admin/includes/image.php#L609-L634
					`${ getFileBasename( item.file.name ) }-pdf`,
					imageQuality
				);
				dispatch.addPoster( id, pdfThumbnail );
		}

		if ( item.isSideload ) {
			dispatch.sideloadItem( id );
		} else {
			dispatch.uploadItem( id );
		}
	};
}

export function addPoster( id: QueueItemId, file: File ): AddPosterAction {
	return {
		type: Type.AddPoster,
		id,
		file,
		url: createBlobURL( file ),
	};
}

export function prepareForTranscoding(
	id: QueueItemId,
	transcode?: TranscodingType[]
): TranscodingPrepareAction {
	return {
		type: Type.TranscodingPrepare,
		id,
		transcode,
	};
}

export function startTranscoding( id: QueueItemId ): TranscodingStartAction {
	return {
		type: Type.TranscodingStart,
		id,
	};
}

export function finishTranscoding(
	id: QueueItemId,
	file: File
): TranscodingFinishAction {
	return {
		type: Type.TranscodingFinish,
		id,
		file,
		url: createBlobURL( file ),
	};
}

export function startUploading( id: QueueItemId ): UploadStartAction {
	return {
		type: Type.UploadStart,
		id,
	};
}

export function finishUploading( id: QueueItemId, attachment: Attachment ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( item ) {
			if (
				'missingImageSizes' in attachment &&
				attachment.missingImageSizes
			) {
				const file = attachment.fileName
					? new File( [ item.sourceFile ], attachment.fileName, {
							type: item.sourceFile.type,
					  } )
					: item.sourceFile;
				const batchId = uuidv4();
				for ( const name of attachment.missingImageSizes ) {
					const imageSize = select.getImageSize( name );
					if ( imageSize ) {
						dispatch.addSideloadItem( {
							file,
							batchId,
							additionalData: {
								// Sideloading does not use the parent post ID but the
								// attachment ID as the image sizes need to be added to it.
								post: attachment.id,
								// Reference the same upload_request if needed.
								upload_request:
									item.additionalData.upload_request,
							},
							resize: imageSize,
							transcode: [ TranscodingType.ResizeCrop ],
						} );
					}
				}
			}
		}

		dispatch< UploadFinishAction >( {
			type: Type.UploadFinish,
			id,
			attachment,
		} );
	};
}

export function finishSideloading( id: QueueItemId ): SideloadFinishAction {
	return {
		type: Type.SideloadFinish,
		id,
	};
}

export function completeItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.removeItem( id );

		if ( item.attachment && item.attachment.mimeType ) {
			// TODO: Trigger client-side thumbnail generation here?

			const mediaType = getMediaTypeFromMimeType(
				item.attachment.mimeType
			);
			if ( [ 'video', 'pdf' ].includes( mediaType ) ) {
				void dispatch.uploadPosterForItem( item );
			}
		}
	};
}

export function removeItem( id: QueueItemId ): RemoveAction {
	return {
		type: Type.Remove,
		id,
	};
}

export function rejectApproval( id: number ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItemByAttachmentId( id );
		if ( ! item ) {
			return;
		}

		dispatch< ApproveUploadAction >( {
			type: Type.ApproveUpload,
			id: item.id,
		} );
	};
}

export function cancelItem( id: QueueItemId, error: Error ): CancelAction {
	return {
		type: Type.Cancel,
		id,
		error,
	};
}

export function maybeTranscodeItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
		registry,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		const transcode = item.transcode ? item.transcode[ 0 ] : undefined;

		// Prevent simultaneous FFmpeg processes to reduce resource usage.
		const isTranscoding = select.isTranscoding();

		switch ( transcode ) {
			case TranscodingType.ResizeCrop:
				void dispatch.resizeCropItem( item.id );
				break;

			case TranscodingType.Heif:
				void dispatch.convertHeifItem( item.id );
				break;

			case TranscodingType.Gif:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.convertGifItem( item.id );
				break;

			case TranscodingType.Audio:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.optimizeAudioItem( item.id );
				break;

			case TranscodingType.Video:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.optimizeVideoItem( item.id );
				break;

			case TranscodingType.MuteVideo:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.muteVideoItem( item.id );
				break;

			case TranscodingType.Image:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.optimizeImageItem( item.id );
				break;

			// TODO: Right now only handles images.
			case TranscodingType.OptimizeExisting:
				if ( isTranscoding ) {
					return;
				}

				const requireApproval = registry
					.select( preferencesStore )
					.get( PREFERENCES_NAME, 'requireApproval' );

				void dispatch.optimizeImageItem( item.id, requireApproval );
				break;

			default:
			// This shouldn't happen. Only happens with too many state updates.
		}
	};
}

export function optimizeImageItem(
	id: QueueItemId,
	requireApproval: boolean = false
) {
	return async ( {
		select,
		dispatch,
		registry,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		const imageFormat: ImageFormat = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'imageFormat' );

		// TODO: Pass quality to all the different encoders.
		const imageQuality: number = registry
			.select( preferencesStore )
			.get( PREFERENCES_NAME, 'imageQuality' );

		try {
			let file: File;

			switch ( imageFormat ) {
				case 'webp-browser':
					file = await convertImageFormat(
						item.file,
						getFileBasename( item.file.name ),
						'image/webp',
						imageQuality / 100
					);
					break;
				case 'jpeg-vips':
					file = await convertImageToJpeg( item.file );
					break;
				case 'jpeg-mozjpeg':
					file = await convertImageToMozJpeg( item.file );
					break;
				case 'avif':
					file = await convertImageToAvif( item.file );
					break;
				case 'webp-ffmpeg':
					file = await convertImageToWebP( item.file );
					break;
				case 'jpeg-browser':
				default:
					file = await convertImageFormat(
						item.file,
						getFileBasename( item.file.name ),
						'image/jpeg',
						imageQuality / 100
					);
					break;
			}

			if ( requireApproval ) {
				dispatch.requestApproval( id, file );
			} else {
				dispatch.finishTranscoding( id, file );
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
		}
	};
}

export function optimizeVideoItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await transcodeVideo( item.file );
			dispatch.finishTranscoding( id, file );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await muteVideo( item.file );
			dispatch.finishTranscoding( id, file );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await transcodeAudio( item.file );
			dispatch.finishTranscoding( id, file );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await convertGifToVideo( item.file );
			dispatch.finishTranscoding( id, file );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await transcodeHeifImage( item.file );
			dispatch.finishTranscoding( id, file );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item || ! item.resize ) {
			return;
		}

		dispatch.startTranscoding( id );

		try {
			const file = await resizeImage( item.file, item.resize );
			dispatch.finishTranscoding( id, file );
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

export function uploadPosterForItem( item: QueueItem ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		const { attachment: uploadedAttachment } = item as QueueItem & {
			attachment: Attachment;
		};

		if ( ! uploadedAttachment ) {
			return;
		}

		// In the event that the uploaded video already has a poster, do not upload another one.
		// Can happen when using muteExistingVideo() or when a poster is generated server-side.
		// TODO: Make the latter scenario actually work.
		//       Use getEntityRecord to actually get poster URL from posterID returned by uploadToServer()
		if (
			uploadedAttachment.poster &&
			! isBlobURL( uploadedAttachment.poster )
		) {
			return;
		}

		try {
			let poster = item.poster;

			if (
				! poster &&
				'video' === getMediaTypeFromMimeType( item.file.type )
			) {
				// Derive the basename from the uploaded video's file name
				// if available for more accuracy.
				poster = await getPosterFromVideo(
					uploadedAttachment.url,
					`${ getFileBasename(
						uploadedAttachment.fileName ??
							getFileNameFromUrl( uploadedAttachment.url )
					) }}-poster`
				);
			}

			if ( ! poster ) {
				return;
			}

			// Adding the poster to the queue on its own allows for it to be optimized, etc.
			dispatch.addItem( {
				file: poster,
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
						...uploadedAttachment,
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
					updateMediaItem( uploadedAttachment.id, {
						featured_media: posterAttachment.id,
						meta: {
							mexp_generated_poster_id: posterAttachment.id,
						},
					} );
				},
				additionalData: {
					// Reminder: Parent post ID might not be set, depending on context,
					// but should be carried over if it does.
					post: item.additionalData.post,
				},
				mediaSourceTerms: [ 'poster-generation' ],
				blurHash: item.blurHash,
				dominantColor: item.dominantColor,
			} );
		} catch ( err ) {
			// TODO: Debug & catch & throw.
		}
	};
}

export function uploadItem( id: QueueItemId ) {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		const { poster } = item;

		dispatch.startUploading( id );

		const additionalData = {
			...item.additionalData,
			mexp_media_source: item.mediaSourceTerms
				?.map( ( slug ) => select.getMediaSourceTermId( slug ) )
				.filter( Boolean ) as number[],
			// generatedPosterId is set when using muteExistingVideo() for example.
			meta: {
				mexp_blurhash: item.blurHash,
				mexp_dominant_color: item.dominantColor,
				mexp_generated_poster_id: item.generatedPosterId,
				mexp_original_id: item.sourceAttachmentId,
				mexp_is_muted: false,
			},
			featured_media: item.generatedPosterId,
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
		if ( 'video' === mediaType ) {
			try {
				const hasAudio =
					item.attachment?.url &&
					( await videoHasAudio( item.attachment.url ) );
				additionalData.meta.mexp_is_muted = ! hasAudio;
			} catch {
				// No big deal if this fails, we can still continue uploading.
			}
		}

		if ( ! additionalData.meta.mexp_dominant_color && stillUrl ) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				additionalData.meta.mexp_dominant_color =
					await dominantColorWorker.getDominantColor( stillUrl );
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if ( ! additionalData.meta?.mexp_blurhash && stillUrl ) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				additionalData.meta.mexp_blurhash =
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
				additionalData
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

			dispatch.finishUploading( id, attachment );
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
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		dispatch.startUploading( id );

		try {
			// TODO: Do something with result.
			await sideloadFile( item.file, {
				...item.additionalData,
				image_size: item.resize?.name,
			} );

			dispatch.finishSideloading( id );
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
