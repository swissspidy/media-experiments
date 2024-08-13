import { addFilter } from '@wordpress/hooks';
import { createBlobURL } from '@wordpress/blob';
import { type Block, type BlockInstance, createBlock } from '@wordpress/blocks';

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
						files.every(
							( file: File ) =>
								file.type.startsWith( 'video' ) ||
								file.type.startsWith( 'image/' ) ||
								file.type.startsWith( 'audio/' )
						)
					);
				},
				transform( files: File[] ) {
					const blocks: BlockInstance< {} >[] = [];

					files.forEach( ( file ) => {
						if ( file.type.startsWith( 'video/' ) ) {
							blocks.push(
								createBlock( 'core/video', {
									src: createBlobURL( file ),
								} )
							);
						} else if ( file.type.startsWith( 'image/' ) ) {
							blocks.push(
								createBlock( 'core/image', {
									url: createBlobURL( file ),
								} )
							);
						} else if ( file.type.startsWith( 'audio/' ) ) {
							blocks.push(
								createBlock( 'core/audio', {
									src: createBlobURL( file ),
								} )
							);
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
