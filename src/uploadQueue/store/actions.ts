import { v4 as uuidv4 } from 'uuid';

import { createBlobURL, isBlobURL } from '@wordpress/blob';

import {
	AdditionalData,
	Attachment,
	CreateRestAttachment,
	ItemStatus,
	OnChangeHandler,
	OnErrorHandler,
	OnSuccessHandler,
	QueueItem,
	QueueItemId,
	TranscodingType,
	Type,
} from './types';
import { convertGifToVideo, transcodeAudio, transcodeVideo } from '../ffmpeg';
import UploadError from '../uploadError';
import {
	blobToFile,
	canTranscodeFile,
	fetchRemoteFile,
	getFileBasename,
	getFileNameFromUrl,
	getPosterFromVideo,
	isAnimatedGif,
	isHeifImage,
	videoHasAudio,
} from '../utils';
import { transcodeHeifImage } from '../heif';
import { updateMediaItem, uploadToServer } from '../api';
import { getMediaTypeFromMimeType } from '../../utils';
import { getMediaSourceTermId } from './selectors';

interface AddItemArgs {
	file: File;
	batchId: string;
	onChange?: OnChangeHandler;
	onSuccess?: OnSuccessHandler;
	onError?: OnErrorHandler;
	additionalData?: AdditionalData;
	sourceUrl?: string;
	sourceAttachmentId?: number;
	mediaSourceTerms?: string[];
}

export function addItem({
	file,
	batchId,
	onChange,
	onSuccess,
	onError,
	additionalData = {},
	sourceUrl,
	sourceAttachmentId,
	mediaSourceTerms = [],
}: AddItemArgs) {
	return {
		type: Type.Add,
		item: {
			id: uuidv4(),
			batchId,
			status: ItemStatus.Pending,
			file,
			attachment: {
				url: createBlobURL(file),
			},
			additionalData,
			onChange,
			onSuccess,
			onError,
			sourceUrl,
			sourceAttachmentId,
			mediaSourceTerms,
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

export function addItemFromUrl({
	url,
	onChange,
	onSuccess,
	onError,
	additionalData,
}: AddItemFromUrlArgs) {
	return async ({ dispatch }) => {
		const file = await fetchRemoteFile(url);

		dispatch.addItem({
			file,
			onChange,
			onSuccess,
			onError,
			additionalData,
			sourceUrl: url,
			mediaSourceTerms: ['media-import'],
		});
	};
}

export function prepareItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);
		const { file } = item;

		dispatch({
			type: Type.Prepare,
			id,
		});

		const mediaType = getMediaTypeFromMimeType(file.type);
		const blobUrl = createBlobURL(file);

		const canTranscode = canTranscodeFile(file);

		console.log('Pending item', item, mediaType, canTranscode);

		switch (mediaType) {
			case 'image':
				const fileBuffer = await file.arrayBuffer();

				// TODO: Here we could convert all images to WebP/AVIF/xyz by default.

				const isHeif = isHeifImage(fileBuffer);
				const isGif = isAnimatedGif(fileBuffer);

				if (isHeif) {
					// TODO: Do we need a placeholder for a HEIF image?
					// Maybe a base64 encoded 1x1 gray PNG?
					// Use preloadImage() and getImageDimensions() so see if browser can render it.
					// Image/Video block already have a placeholder state.
					dispatch.prepareForTranscoding(id, TranscodingType.Heif);
					return;
				}

				if (isGif && canTranscode) {
					dispatch.prepareForTranscoding(id, TranscodingType.Gif);
					return;
				}

				break;

			case 'video':
				// Here we are potentially dealing with an unsupported file type (e.g. MOV)
				// that cannot be *played* by the browser, but could still be used for generating a poster.

				// TODO: is this the right place?
				// Note: Causes another state update.
				const poster = await getPosterFromVideo(
					blobUrl,
					`${getFileBasename(item.file.name)}-poster`
				);
				dispatch.addPoster(id, poster);

				console.log('before upload add poster for video', item, poster);

				// TODO: First check if video already meets criteria, e.g. with mediainfo.js.
				// No need to compress a video that's already quite small.

				if (canTranscode) {
					dispatch.prepareForTranscoding(id);
					return;
				}

				break;

			case 'audio':
				if (canTranscode) {
					dispatch.prepareForTranscoding(id, TranscodingType.Audio);
					return;
				}

				break;
		}

		dispatch.uploadItem(id);
	};
}

export function addPoster(id: QueueItemId, file: File) {
	return {
		type: Type.AddPoster,
		id,
		file,
		url: createBlobURL(
			blobToFile(
				file,
				`${getFileBasename(file.name)}-poster.jpeg`,
				'image/jpeg'
			)
		),
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

export function startTranscoding(id: QueueItemId) {
	return {
		type: Type.TranscodingStart,
		id,
	};
}

export function finishTranscoding(id: QueueItemId, file: File) {
	return {
		type: Type.TranscodingFinish,
		id,
		file,
		url: createBlobURL(file),
	};
}

export function startUploading(id: QueueItemId) {
	return {
		type: Type.UploadStart,
		id,
	};
}

export function finishUploading(id: QueueItemId, attachment: Attachment) {
	return {
		type: Type.UploadFinish,
		id,
		attachment,
	};
}

export function completeItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		const { attachment } = item;

		const mediaType = getMediaTypeFromMimeType(attachment.mimeType);

		dispatch.removeItem(id);

		if ('video' === mediaType) {
			console.log('before uploadPosterForItem', id, item);
			void dispatch.uploadPosterForItem(item);
		}
	};
}

export function removeItem(id: QueueItemId) {
	return {
		type: Type.Remove,
		id,
	};
}

export function cancelItem(id: QueueItemId, error: Error) {
	return {
		type: Type.Cancel,
		id,
		error,
	};
}

export function maybeTranscodeItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		const { transcode } = item;

		// Prevent simultaneous ffmpeg processes to reduce resource usage.
		const isTranscoding = select.isTranscoding();

		console.log('pending transcoding for', item, isTranscoding);

		switch (transcode) {
			case TranscodingType.Heif:
				void dispatch.convertHeifItem(item.id);
				break;

			case TranscodingType.Gif:
				if (isTranscoding) {
					return;
				}

				void dispatch.convertGifItem(item.id);
				break;

			case TranscodingType.Audio:
				if (isTranscoding) {
					return;
				}

				void dispatch.optimizeAudioItem(item.id);
				break;

			default:
				if (isTranscoding) {
					return;
				}

				void dispatch.optimizeVideoItem(item.id);
				break;
		}
	};
}

export function optimizeVideoItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		dispatch.startTranscoding(id);

		try {
			const file = await transcodeVideo(item.file);
			console.log('finish transcoding', file);
			dispatch.finishTranscoding(id, file);
		} catch (error) {
			console.log('optimizeVideoItem failed', error);
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError({
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  })
			);
		}
	};
}

export function optimizeAudioItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		dispatch.startTranscoding(id);

		try {
			const file = await transcodeAudio(item.file);
			console.log('finish transcoding', file);
			dispatch.finishTranscoding(id, file);
		} catch (error) {
			console.log('optimizeAudioItem failed', error);
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError({
							code: 'AUDIO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  })
			);
		}
	};
}

export function convertGifItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		dispatch.startTranscoding(id);

		try {
			const file = await convertGifToVideo(item.file);
			console.log('finish transcoding', file);
			dispatch.finishTranscoding(id, file);
		} catch (error) {
			console.log('convertGifItem failed', error);
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError({
							code: 'VIDEO_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  })
			);
		}
	};
}

export function convertHeifItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		dispatch.startTranscoding(id);

		try {
			const file = await transcodeHeifImage(item.file);
			console.log('finish transcoding', file);
			dispatch.finishTranscoding(id, file);
		} catch (error) {
			console.log('convertHeifItem failed', error);
			dispatch.cancelItem(
				id,
				error instanceof Error
					? error
					: new UploadError({
							code: 'IMAGE_TRANSCODING_ERROR',
							message: 'File could not be uploaded',
							file: item.file,
					  })
			);
		}
	};
}

export function uploadPosterForItem(item: QueueItem) {
	return async ({ dispatch }) => {
		console.log('inside uploadPosterForItem', item);

		const { attachment: videoAttachment } = item;

		// In the unlikely (impossible?) event that the uploaded video already has a poster,
		// do not upload another one.
		if (videoAttachment.poster && !isBlobURL(videoAttachment.poster)) {
			return;
		}

		try {
			// Derive the basename from the uploaded video's file name
			// for more accuracy.
			const poster =
				item.poster ||
				(await getPosterFromVideo(
					videoAttachment.url,
					`${getFileBasename(
						getFileNameFromUrl(videoAttachment.url)
					)}}-poster`
				));

			console.log('uploadPosterForItem', item, poster);

			// Adding the poster to the queue on its own allows for it to be optimized, etc.
			dispatch.addItem({
				file: poster,
				onChange: ([posterAttachment]) => {
					console.log(
						'onChange uploadPosterForItem',
						posterAttachment,
						videoAttachment
					);
					if (isBlobURL(posterAttachment.url)) {
						return;
					}

					// Video block expects such a structure for the poster.
					// https://github.com/WordPress/gutenberg/blob/e0a413d213a2a829ece52c6728515b10b0154d8d/packages/block-library/src/video/edit.js#L154
					const updatedVideoAttachment = {
						...videoAttachment,
						image: {
							src: posterAttachment.url,
						},
					};

					// This might be confusing, but the idea is to update the original
					// video item in the editor with the newly uploaded poster.
					item.onChange?.([updatedVideoAttachment]);
				},
				onSuccess: ([posterAttachment]) => {
					console.log(
						'onSuccess uploadPosterForItem',
						posterAttachment,
						videoAttachment
					);

					// Similarly, update the original video in the DB to have the
					// poster as the featured image.
					updateMediaItem(videoAttachment.id, {
						featured_media: posterAttachment.id,
						meta: {
							mexp_generated_poster_id: posterAttachment.id,
						},
					});
				},
				additionalData: {
					post: item.additionalData.post,
				},
				mediaSourceTerms: ['poster-generation'],
			});
		} catch (err) {
			console.log('completion error', err);
		}
	};
}

export function uploadItem(id: QueueItemId) {
	return async ({ select, dispatch }) => {
		const item: QueueItem = select.getItem(id);

		let { poster } = item;

		dispatch.startUploading(id);

		const additionalData: CreateRestAttachment = {
			...item.additionalData,
			mexp_media_source: item.mediaSourceTerms
				.map<number | undefined>((slug) =>
					select.getMediaSourceTermId(slug)
				)
				.filter(Boolean),
			meta: {},
		};

		const mediaType = getMediaTypeFromMimeType(item.file.type);

		if ('video' === mediaType) {
			try {
				const hasAudio = await videoHasAudio(item.attachment.url);
				additionalData.meta.mexp_is_muted = !hasAudio;
			} catch {
				// No big deal if this fails, we can still continue uploading.
			}
		}

		try {
			console.log('startUploading', id, additionalData);
			const attachment = await uploadToServer(item.file, additionalData);

			if ('video' === mediaType) {
				// The newly uploaded file won't have a poster yet.
				// However, we'll likely still have one on file.
				// Add it back so we're never without one.
				if (item.attachment.poster) {
					attachment.poster = item.attachment.poster;
				} else if (poster) {
					attachment.poster = createBlobURL(poster);
				}
			}

			console.log('finishUploading', id);

			dispatch.finishUploading(id, attachment);
		} catch (err) {
			console.log(err);

			dispatch.cancelItem(id, err);
		}
	};
}

export function setMediaSourceTerms(terms: Record<string, number>) {
	return {
		type: Type.SetMediaSourceTerms,
		terms,
	};
}
