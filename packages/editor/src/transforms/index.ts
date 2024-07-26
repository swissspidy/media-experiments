import { addFilter } from '@wordpress/hooks';
import { createBlobURL } from '@wordpress/blob';
import { type Block, type BlockInstance, createBlock } from '@wordpress/blocks';

import { getMediaTypeFromMimeType } from '@mexp/mime';

type Writable< T > = { -readonly [ P in keyof T ]: Writable< T[ P ] > };

type FilterableBlock = Writable< Block >;

function addMultiFileTransformToBlock(
	settings: FilterableBlock,
	name: string
) {
	switch ( name ) {
		case 'core/video':
		case 'core/image':
		case 'core/audio':
			if ( ! settings.transforms || ! settings.transforms.from ) {
				return;
			}

			// Prevent incorrect 'If uploading to a gallery all files need to be image formats' snackbar from image block.
			if ( 'core/image' === name ) {
				settings.transforms.from = settings.transforms.from.filter(
					( transform ) => transform.type !== 'files'
				);
			}

			settings.transforms.from.unshift( {
				type: 'files',
				// Higher than the default priority of 10, so that this is picked up
				// before the image block's misc-type transform, which causes an incorrect
				// "If uploading to a gallery all files need to be image formats"
				// snackbar to appear.
				priority: 5,
				isMatch( files: File[] ) {
					return (
						files.length > 0 &&
						files.every( ( file: File ) =>
							[ 'video', 'image', 'audio' ].includes(
								getMediaTypeFromMimeType( file.type )
							)
						)
					);
				},
				transform( files: File[] ) {
					const blocks: BlockInstance< {} >[] = [];

					files.forEach( ( file ) => {
						const mediaType = getMediaTypeFromMimeType( file.type );
						switch ( mediaType ) {
							case 'video':
								blocks.push(
									createBlock( 'core/video', {
										src: createBlobURL( file ),
									} )
								);
								break;

							case 'image':
								blocks.push(
									createBlock( 'core/image', {
										url: createBlobURL( file ),
									} )
								);
								break;

							case 'audio':
								blocks.push(
									createBlock( 'core/audio', {
										src: createBlobURL( file ),
									} )
								);
								break;
						}
					} );

					return blocks;
				},
			} );
			break;
	}

	return settings;
}

addFilter(
	'blocks.registerBlockType',
	'media-experiments/transforms/file-drop',
	addMultiFileTransformToBlock
);
