/**
 * External dependencies
 */
import type { RestAttachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { useEntityRecord } from '@wordpress/core-data';

interface AnimatedGifDetectorProps {
	id: number;
	clientId: string;
	url: string;
	caption: string;
}

// This should eventually live in the video block's edit component.
export function AnimatedGifConverter( {
	id,
	url,
	caption,
	clientId,
}: AnimatedGifDetectorProps ) {
	const { record: attachment } = useEntityRecord< RestAttachment | null >(
		'postType',
		'attachment',
		id
	);

	const isVideo = attachment?.mime_type.startsWith( 'video/' );

	const { replaceBlocks } = useDispatch( blockEditorStore );

	useEffect( () => {
		if ( ! isVideo ) {
			return;
		}

		// Not adding the poster because it is probably not fully uploaded yet.
		// TODO: Figure out how to add the poster afterwards.
		void replaceBlocks(
			clientId,
			createBlock( 'core/video', {
				controls: false,
				loop: true,
				autoplay: true,
				muted: true,
				playsInline: true,
				id,
				src: url,
				caption,
			} )
		);
	}, [ id, isVideo, clientId, caption, url, replaceBlocks ] );

	return null;
}
