import { dispatch, select, subscribe } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as preferencesStore } from '@wordpress/preferences';

import { store as uploadStore } from './store';
import type {
	AdditionalData,
	Attachment,
	OnChangeHandler,
	OnErrorHandler,
	QueueItem,
	RestAttachment,
	WP_REST_API_Term,
} from './store/types';
import UploadError from './uploadError';

export { uploadMedia } from './uploadMedia';

export type {
	AdditionalData,
	OnChangeHandler,
	OnErrorHandler,
	Attachment,
	RestAttachment,
};

export { uploadStore as store, UploadError };

// Loop through new items, add additional metadata where needed,
// and eventually upload items to the server.
subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getPendingItems();
	for ( const { id } of items ) {
		void dispatch( uploadStore ).prepareItem( id );
	}
}, uploadStore );

subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getTranscodedItems();
	for ( const { id, isSideload } of items ) {
		if ( isSideload ) {
			void dispatch( uploadStore ).sideloadItem( id );
		} else {
			void dispatch( uploadStore ).uploadItem( id );
		}
	}
}, uploadStore );

subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getApprovedItems();
	for ( const { id } of items ) {
		void dispatch( uploadStore ).uploadItem( id );
	}
}, uploadStore );

// Try to get dimensions and poster for placeholder resources.
// This way we can show something more meaningful to the user before transcoding has finished.
// Since this uses ffmpeg, we're going to limit this to one at a time.

// For pending video items without a poster still, use FFmpeg to generate a poster.
// This way we can show something more meaningful to the user before transcoding has finished.
// Since this uses FFmpeg, we're going to limit this to one at a time.

// TODO: Generate poster with FFmpeg if missing.
// Could be after converting gif or similar.
// Update poster in video block (should revoke temp blob URL)
// When video upload finishes, also upload poster image.

// Set temporary URL to create placeholder media file, this is replaced
// with final file from media gallery when upload is `done` below.
// TODO: remove in favor of logic below.

subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getInProgressItems();
	for ( const item of items ) {
		const { attachment, onChange } = item;

		if ( ! attachment ) {
			continue;
		}

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
}, uploadStore );

subscribe( () => {
	const items: QueueItem[] =
		select( uploadStore ).getPendingTranscodingItems();
	for ( const { id } of items ) {
		void dispatch( uploadStore ).maybeTranscodeItem( id );
	}
}, uploadStore );

subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getUploadedItems();

	for ( const item of items ) {
		const { id, onChange, onSuccess, attachment } = item;
		if ( attachment ) {
			onChange?.( [ attachment ] );
			onSuccess?.( [ attachment ] );
		}
		void dispatch( uploadStore ).completeItem( id );
	}
}, uploadStore );

subscribe( () => {
	const items: QueueItem[] = select( uploadStore ).getCancelledItems();
	for ( const item of items ) {
		const { id, error, onError } = item;
		onError?.( error ?? new Error( 'Upload cancelled' ) );
		void dispatch( uploadStore ).removeItem( id );
	}
}, uploadStore );

// The WordPress REST API requires passing term IDs instead of slugs.
// We are storing them here in a simple slug => id map so that we can
// still reference them by slug to make things a bit easier.
// TODO: Move this to other package to remove core-data dependency?
const unsubscribeCoreStore = subscribe( () => {
	const termObjects: WP_REST_API_Term[] | null = select(
		coreStore
	).getEntityRecords( 'taxonomy', 'mexp_media_source' );
	if ( termObjects === null ) {
		return;
	}

	const terms: Record< string, number > = {};

	for ( const termObject of termObjects ) {
		terms[ termObject.slug ] = termObject.id;
	}

	void dispatch( uploadStore ).setMediaSourceTerms( terms );
	unsubscribeCoreStore();
}, coreStore );

void dispatch( uploadStore ).setImageSizes(
	window.mediaExperiments.availableImageSizes
);

void dispatch( preferencesStore ).set(
	'media-experiments/preferences',
	'bigImageSizeThreshold',
	window.mediaExperiments.bigImageSizeThreshold
);
