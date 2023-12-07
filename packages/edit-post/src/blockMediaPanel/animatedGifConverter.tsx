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

	const posterId = attachment?.featured_media;
	const poster = useAttachment( id );

	const { replaceBlocks } = useDispatch( blockEditorStore );

	useEffect( () => {
		if (
			! attachment?.mime_type.startsWith( 'video/' ) ||
			( posterId && ! poster?.source_url )
		) {
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
				src: url,
				poster: poster?.source_url,
				caption,
			} )
		);
	}, [
		attachment?.mime_type,
		clientId,
		caption,
		url,
		poster?.source_url,
		posterId,
		replaceBlocks,
	] );

	return null;
}
