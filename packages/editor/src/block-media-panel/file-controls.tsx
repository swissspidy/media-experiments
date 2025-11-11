/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { createBlock } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import type { FileBlock } from '../types';

type FileControlsProps = FileBlock &
	Pick< BlockEditProps< FileBlock[ 'attributes' ] >, 'setAttributes' >;

export function FileControls( props: FileControlsProps ) {
	const [ isConverting, setIsConverting ] = useState( false );
	const { replaceBlocks } = useDispatch( blockEditorStore );

	async function handleConvertToBlocks() {
		if ( ! props.attributes.id || ! props.attributes.href ) {
			return;
		}

		setIsConverting( true );

		try {
			const { getTextFromPdf } = await import(
				/* webpackChunkName: 'pdf' */ '@mexp/pdf'
			);

			const texts = await getTextFromPdf( props.attributes.href );

			// Create paragraph blocks from the extracted text
			const blocks = texts
				.filter( ( text ) => text.trim().length > 0 )
				.map( ( text ) => {
					return createBlock( 'core/paragraph', {
						content: text,
					} );
				} );

			if ( blocks.length > 0 ) {
				// Replace the file block with the new paragraph blocks
				replaceBlocks( props.clientId, blocks );
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'Error converting PDF to blocks:', error );
		} finally {
			setIsConverting( false );
		}
	}

	// Only show the button if this is a PDF file
	const isPdf =
		props.attributes.href &&
		props.attributes.href.toLowerCase().endsWith( '.pdf' );

	if ( ! isPdf ) {
		return null;
	}

	return (
		<Button
			variant="secondary"
			onClick={ handleConvertToBlocks }
			disabled={ isConverting || ! props.attributes.id }
		>
			{ isConverting
				? __( 'Converting…', 'media-experiments' )
				: __( 'Convert to blocks', 'media-experiments' ) }
		</Button>
	);
}
