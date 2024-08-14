/**
 * External dependencies
 */
import { createWorkerFactory } from '@shopify/web-worker';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { BlockControls } from '@wordpress/block-editor';
import { ToolbarDropdownMenu } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';
import { useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { ReactComponent as PhotoSpark } from '../icons/photo-spark.svg';

const createAiWorker = createWorkerFactory(
	() => import( /* webpackChunkName: 'ai' */ '@mexp/ai' )
);

const aiWorker = createAiWorker();

interface GenerateCaptionsProps {
	url?: string;
	onUpdateCaption: ( caption: string ) => void;
	onUpdateAltText: ( alt: string ) => void;
}

export function GenerateCaptions( {
	url,
	onUpdateCaption,
	onUpdateAltText,
}: GenerateCaptionsProps ) {
	const [ captionInProgress, setCaptionInProgress ] = useState( false );
	const [ altInProgress, setAltInProgress ] = useState( false );

	const { createErrorNotice } = useDispatch( noticesStore );

	if ( ! url ) {
		return null;
	}

	const controls = [
		{
			title: __( 'Write caption', 'media-experiments' ),
			onClick: async () => {
				setCaptionInProgress( true );

				try {
					const result = await aiWorker.generateCaption(
						url,
						'<CAPTION>'
					);
					onUpdateCaption( result );
				} catch {
					void createErrorNotice(
						__(
							'There was an error generating the caption',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				} finally {
					setCaptionInProgress( false );
				}
			},
			role: 'menuitemradio',
			icon: undefined,
			isDisabled: captionInProgress,
		},
		{
			title: __( 'Write alternative text', 'media-experiments' ),
			onClick: async () => {
				setAltInProgress( true );

				try {
					const result = await aiWorker.generateCaption(
						url,
						'<DETAILED_CAPTION>'
					);
					onUpdateAltText( result );
				} catch {
					void createErrorNotice(
						__(
							'There was an error generating the alternative text',
							'media-experiments'
						),
						{
							type: 'snackbar',
						}
					);
				} finally {
					setAltInProgress( false );
				}
			},
			role: 'menuitemradio',
			icon: undefined,
			isDisabled: altInProgress,
		},
	];
	return (
		<BlockControls group="inline">
			<ToolbarDropdownMenu
				label={ __( 'Help me write', 'media-experiments' ) }
				icon={ <PhotoSpark /> }
				controls={ controls }
			/>
		</BlockControls>
	);
}
