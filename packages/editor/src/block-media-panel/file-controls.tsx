/**
 * External dependencies
 */
import type { RestAttachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { rawHandler } from '@wordpress/blocks';
import { useDispatch } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as noticesStore } from '@wordpress/notices';
import { useState } from '@wordpress/element';
import { useEntityRecord } from '@wordpress/core-data';

/**
 * Internal dependencies
 */
import type { FileBlock } from '../types';

type FileControlsProps = FileBlock &
	Pick< BlockEditProps< FileBlock[ 'attributes' ] >, 'setAttributes' >;

export function FileControls( props: FileControlsProps ) {
	const [ isConverting, setIsConverting ] = useState( false );
	const { replaceBlocks } = useDispatch( blockEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );

	const { record: attachment } = useEntityRecord< RestAttachment | null >(
		'postType',
		'attachment',
		props.attributes.id
	);

	const isPdf = attachment?.mime_type === 'application/pdf';

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
			const blocks = rawHandler( { HTML: texts.join( '\n\n' ) } );

			if ( blocks.length > 0 ) {
				// Replace the file block with the new paragraph blocks
				replaceBlocks( props.clientId, blocks );
				createSuccessNotice(
					__( 'PDF converted to blocks', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);
			} else {
				createErrorNotice(
					__( 'No text content found in PDF', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);
			}
		} catch ( error ) {
			// eslint-disable-next-line no-console -- Deliberately log errors for debugging.
			console.error( 'PDF conversion error:', error );
			createErrorNotice(
				__( 'Error converting PDF to blocks', 'media-experiments' ),
				{
					type: 'snackbar',
				}
			);
		} finally {
			setIsConverting( false );
		}
	}

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
