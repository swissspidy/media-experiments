import { useEffect } from '@wordpress/element';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';

import { useAttachment } from '../utils/hooks';

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
	const attachment = useAttachment( id );

	const isVideo = attachment?.mime_type.startsWith( 'video/' );

	const posterId = attachment?.featured_media;
	const poster = useAttachment( id );
	const posterUrl = poster?.source_url;

	const { replaceBlocks } = useDispatch( blockEditorStore );

	useEffect( () => {
		if ( ! isVideo || ( posterId && ! posterUrl ) ) {
			return;
		}

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
				poster: posterUrl,
				caption,
			} )
		);
	}, [
		id,
		isVideo,
		clientId,
		caption,
		url,
		posterId,
		posterUrl,
		replaceBlocks,
	] );

	return null;
}
