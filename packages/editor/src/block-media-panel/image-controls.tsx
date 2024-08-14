/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';
import type { BlockEditProps } from '@wordpress/blocks';
import { isBlobURL } from '@wordpress/blob';

/**
 * Internal dependencies
 */
import { UploadIndicator } from './upload-indicator';
import { RecordingControls } from './recording-controls';
import { ImportMedia } from './import-media';
import { OptimizeMedia } from './optimize-media';
import { DebugInfo } from './debug-info';
import type { ImageBlock } from './types';
import { AnimatedGifConverter } from './animated-gif-converter';
import { UploadRequestControls } from './upload-requests/controls';
import { GenerateCaptions } from './generate-caption';

type ImageControlsProps = ImageBlock &
	Pick< BlockEditProps< ImageBlock[ 'attributes' ] >, 'setAttributes' >;

export function ImageControls( props: ImageControlsProps ) {
	function onImportMedia( media: Partial< Attachment > ) {
		// Ignore blob URLs as otherwise the block tries to upload it again.
		if ( ! media || ! media.url || isBlobURL( media.url ) ) {
			return;
		}

		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	function onOptimizeMedia( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			url: media.url,
			id: media.id,
		} );
	}

	function onInsertRecording( url?: string ) {
		if ( url ) {
			props.setAttributes( {
				url,
			} );
		}
	}

	function onInsertFromUploadRequest( [ media ]: Partial< Attachment >[] ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			id: media.id,
			url: media.url,
		} );
	}

	function onUpdateCaption( caption: string ) {
		props.setAttributes( {
			caption,
		} );
	}

	function onUpdateAltText( alt: string ) {
		props.setAttributes( {
			alt,
		} );
	}

	return (
		<Fragment>
			<AnimatedGifConverter
				id={ props.attributes.id }
				url={ props.attributes.url }
				caption={ props.attributes.caption }
				clientId={ props.clientId }
			/>
			<UploadIndicator
				id={ props.attributes.id }
				url={ props.attributes.url }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.url }
				onInsert={ onInsertRecording }
				recordingTypes={ [ 'image' ] }
			/>
			{ ! props.attributes.url ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'image' ] }
					accept={ [ 'image/*' ] }
				/>
			) : null }
			{ ! props.attributes.id ? (
				<ImportMedia
					url={ props.attributes.url }
					onChange={ onImportMedia }
				/>
			) : null }
			<OptimizeMedia
				id={ props.attributes.id }
				url={ props.attributes.url }
				onSuccess={ onOptimizeMedia }
			/>
			<GenerateCaptions
				url={ props.attributes.url }
				onUpdateCaption={ onUpdateCaption }
				onUpdateAltText={ onUpdateAltText }
			/>
			<DebugInfo id={ props.attributes.id } />
		</Fragment>
	);
}
