import { v4 as uuidv4 } from 'uuid';

import { createBlobURL, isBlobURL } from '@wordpress/blob';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as preferencesStore } from '@wordpress/preferences';

import {
	convertGifToVideo,
	muteVideo,
	transcodeAudio,
	convertImageToWebP,
	transcodeVideo,
} from '@mexp/ffmpeg';
import { convertImageToJpeg } from '@mexp/vips';
import { isHeifImage, transcodeHeifImage } from '@mexp/heif';
import { getImageFromPdf } from '@mexp/pdf';
import {
	convertImageToJpeg as convertImageToMozJpeg,
	convertImageToAvif,
} from '@mexp/jsquash';
import { getFileBasename, getMediaTypeFromMimeType } from '@mexp/media-utils';

import {
	type AdditionalData,
	type Attachment,
	ItemStatus,
	type OnChangeHandler,
	type OnErrorHandler,
	type OnSuccessHandler,
	type QueueItem,
	type QueueItemId,
	TranscodingType,
	Type,
} from './types';
import UploadError from '../uploadError';
import {
	canTranscodeFile,
	fetchRemoteFile,
	getBlurHash,
	getDominantColor,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	videoHasAudio,
} from '../utils';
import { updateMediaItem, uploadToServer } from '../api';

type ActionCreators = {
	uploadItem: typeof uploadItem;
	addItem: typeof addItem;
	removeItem: typeof removeItem;
	muteVideoItem: typeof muteVideoItem;
	convertHeifItem: typeof convertHeifItem;
	convertGifItem: typeof convertGifItem;
	optimizeVideoItem: typeof optimizeVideoItem;
	optimizeAudioItem: typeof optimizeAudioItem;
	optimizeItemWithApproval: typeof optimizeItemWithApproval;
	requestApproval: typeof requestApproval;
	rejectApproval: typeof rejectApproval;
	grantApproval: typeof grantApproval;
	prepareForTranscoding: typeof prepareForTranscoding;
	startTranscoding: typeof startTranscoding;
	finishTranscoding: typeof finishTranscoding;
	startUploading: typeof startUploading;
	finishUploading: typeof finishUploading;
	cancelItem: typeof cancelItem;
	uploadPosterForItem: typeof uploadPosterForItem;
	addPoster: typeof addPoster;
	( args: Record< string, unknown > ): void;
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
	batchId?: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
	sourceUrl?: string;
	sourceAttachmentId?: number;
	mediaSourceTerms?: string[];
	blurHash?: string;
	dominantColor?: string;
}

export function addItem( {
	file,
	batchId,
	onChange,
	onSuccess,
	onError,
	additionalData = {},
	sourceUrl,
	sourceAttachmentId,
	mediaSourceTerms = [],
	blurHash,
	dominantColor,
}: AddItemArgs ) {
	return {
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
			additionalData,
			onChange,
			onSuccess,
			onError,
			sourceUrl,
			sourceAttachmentId,
			mediaSourceTerms,
			blurHash,
			dominantColor,
		},
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
	additionalData,
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

		dispatch( {
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
				transcode: TranscodingType.MuteVideo,
				generatedPosterId,
			},
		} );
	};
}

interface OptimizexistingItemArgs {
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

export function optimizeExistingItem( {
	id,
	url,
	poster,
	onChange,
	onSuccess,
	onError,
	additionalData,
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

		dispatch( {
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
				transcode: TranscodingType.OptimizeExisting,
				generatedPosterId,
				needsApproval: true,
			},
		} );
	};
}

export function requestApproval( id: QueueItemId, file: File ) {
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

		dispatch( {
			type: Type.Prepare,
			id,
		} );

		// Transcoding type has already been set, e.g. via muteExistingVideo().
		// TODO: Check canTransocde either here, in muteExistingVideo, or in the UI.
		if ( item.transcode ) {
			dispatch.prepareForTranscoding( id, item.transcode );
			return;
		}

		const mediaType = getMediaTypeFromMimeType( file.type );
		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const canTranscode = canTranscodeFile( file );

		// eslint-disable-next-line @wordpress/no-unused-vars-before-return
		const imageQuality = registry
			.select( preferencesStore )
			.get( 'media-experiments/preferences', 'imageQuality' );

		switch ( mediaType ) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				// TODO: Here we could convert all images to WebP/AVIF/xyz by default.

				// TODO: Enforce big image size threshold.
				// Probably need to use e.g. mediainfo.js to get dimensions early on.

				const isHeif = isHeifImage( fileBuffer );
				const isGif = isAnimatedGif( fileBuffer );

				if ( isHeif ) {
					// TODO: Do we need a placeholder for a HEIF image?
					// Maybe a base64 encoded 1x1 gray PNG?
					// Use preloadImage() and getImageDimensions() so see if browser can render it.
					// Image/Video block already have a placeholder state.
					dispatch.prepareForTranscoding( id, TranscodingType.Heif );
					return;
				}

				if ( isGif && canTranscode ) {
					dispatch.prepareForTranscoding( id, TranscodingType.Gif );
					return;
				}

				break;

			case 'video':
				// Here we are potentially dealing with an unsupported file type (e.g. MOV)
				// that cannot be *played* by the browser, but could still be used for generating a poster.

				// TODO: is this the right place?
				// Note: Causes another state update.
				const poster = await getPosterFromVideo(
					createBlobURL( file ),
					`${ getFileBasename( item.file.name ) }-poster`,
					imageQuality
				);
				dispatch.addPoster( id, poster );

				// TODO: First check if video already meets criteria, e.g. with mediainfo.js.
				// No need to compress a video that's already quite small.

				if ( canTranscode ) {
					dispatch.prepareForTranscoding( id );
					return;
				}

				break;

			case 'audio':
				if ( canTranscode ) {
					dispatch.prepareForTranscoding( id, TranscodingType.Audio );
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

		dispatch.uploadItem( id );
	};
}

export function addPoster( id: QueueItemId, file: File ) {
	return {
		type: Type.AddPoster,
		id,
		file,
		url: createBlobURL( file ),
	};
}

export function prepareForTranscoding(
	id: QueueItemId,
	transcode: TranscodingType = TranscodingType.Default
) {
	return {
		type: Type.TranscodingPrepare,
		id,
		transcode,
	};
}

export function startTranscoding( id: QueueItemId ) {
	return {
		type: Type.TranscodingStart,
		id,
	};
}

export function finishTranscoding( id: QueueItemId, file: File ) {
	return {
		type: Type.TranscodingFinish,
		id,
		file,
		url: createBlobURL( file ),
	};
}

export function startUploading( id: QueueItemId ) {
	return {
		type: Type.UploadStart,
		id,
	};
}

export function finishUploading( id: QueueItemId, attachment: Attachment ) {
	return {
		type: Type.UploadFinish,
		id,
		attachment,
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

		if ( item.attachment ) {
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

export function removeItem( id: QueueItemId ) {
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

		dispatch( {
			type: Type.ApproveUpload,
			id: item.id,
		} );
	};
}

export function cancelItem( id: QueueItemId, error: Error ) {
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
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const item = select.getItem( id );
		if ( ! item ) {
			return;
		}

		const { transcode } = item;

		// Prevent simultaneous ffmpeg processes to reduce resource usage.
		const isTranscoding = select.isTranscoding();

		switch ( transcode ) {
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

			case TranscodingType.MuteVideo:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.muteVideoItem( item.id );
				break;

			case TranscodingType.OptimizeExisting:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.optimizeItemWithApproval( item.id );
				break;

			default:
				if ( isTranscoding ) {
					return;
				}

				void dispatch.optimizeVideoItem( item.id );
				break;
		}
	};
}

export function optimizeItemWithApproval( id: QueueItemId ) {
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

		const imageFormat = registry
			.select( preferencesStore )
			.get( 'media-experiments/preferences', 'imageFormat' );

		try {
			let file: File;

			switch ( imageFormat ) {
				case 'jpeg':
					file = await convertImageToJpeg( item.file );
					break;
				case 'mozjpeg':
					file = await convertImageToMozJpeg( item.file );
					break;
				case 'avif':
					file = await convertImageToAvif( item.file );
					break;
				case 'webp':
					file = await convertImageToWebP( item.file );
					break;
				default:
					file = await convertImageToWebP( item.file );
					break;
			}

			console.log( 'imageFormat', imageFormat, file );

			const requireApproval = registry
				.select( preferencesStore )
				.get( 'media-experiments/preferences', 'requireApproval' );

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

export function uploadPosterForItem( item: QueueItem ) {
	return async ( {
		dispatch,
		registry,
	}: {
		dispatch: ActionCreators;
		registry: WPDataRegistry;
	} ) => {
		const { attachment: uploadedAttachment } = item;

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
				const imageQuality = registry
					.select( preferencesStore )
					.get( 'media-experiments/preferences', 'imageQuality' );

				// Derive the basename from the uploaded video's file name
				// (instead of the original file name) for more accuracy.
				poster = await getPosterFromVideo(
					uploadedAttachment.url,
					`${ getFileBasename(
						getFileNameFromUrl( uploadedAttachment.url )
					) }}-poster`,
					imageQuality
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
				.filter( Boolean ),
			// generatedPosterId is set when using muteExistingVideo() for example.
			meta: {
				mexp_blurhash: item.blurHash,
				mexp_dominant_color: item.dominantColor,
				mexp_generated_poster_id: item.generatedPosterId,
				mexp_is_muted: false,
			},
			featured_media: item.generatedPosterId,
		};

		const mediaType = getMediaTypeFromMimeType( item.file.type );

		// TODO: Make this async after upload?
		// Could be made reusable to enable backfilling of existing blocks.
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

		// TODO: item.attachment.url might be the (blob) URL of a video, which might not work.
		// Should use getFirstFrameOfVideo() in that case.
		if ( ! additionalData.meta.mexp_dominant_color ) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				const url = item.attachment?.poster || item.attachment?.url;
				if ( url ) {
					additionalData.meta.mexp_dominant_color =
						await getDominantColor( url );
				}
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		if ( ! additionalData.meta?.mexp_blurhash ) {
			// TODO: Make this async after upload?
			// Could be made reusable to enable backfilling of existing blocks.
			// TODO: Move to web worker for performance reasons?
			// TODO: Create a scaled-down version of the image first for performance reasons.
			try {
				const url = item.attachment?.poster || item.attachment?.url;
				if ( url ) {
					additionalData.meta.mexp_blurhash =
						await getBlurHash( url );
				}
			} catch ( err ) {
				// No big deal if this fails, we can still continue uploading.
				// TODO: Debug & catch & throw.
			}
		}

		try {
			// TODO: Save `missing_image_sizes` information for later.
			const attachment = await uploadToServer(
				item.file,
				additionalData
			);

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

export function setMediaSourceTerms( terms: Record< string, number > ) {
	return {
		type: Type.SetMediaSourceTerms,
		terms,
	};
}
