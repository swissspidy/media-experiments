import type { BlockEditProps } from '@wordpress/blocks';
import { Fragment } from '@wordpress/element';

import type { Attachment } from '@mexp/upload-media';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { ImportMedia } from './importMedia';
import type { AudioBlock } from './types';
import { DebugInfo } from './debugInfo';
import { isBlobURL } from '@wordpress/blob';
import { UploadRequestControls } from './uploadRequestControls';

type AudioControlsProps = AudioBlock &
	Pick< BlockEditProps< AudioBlock[ 'attributes' ] >, 'setAttributes' >;

export function AudioControls( props: AudioControlsProps ) {
	function onImportMedia( media: Partial< Attachment > ) {
		// Ignore blob URLs as otherwise the block tries to upload it again.
		if ( ! media || ! media.url || isBlobURL( media.url ) ) {
			return;
		}

		props.setAttributes( {
			src: media.url,
			id: media.id,
		} );
	}

	function onInsertRecording( url?: string ) {
		if ( url ) {
			props.setAttributes( {
				src: url,
			} );
		}
	}

	function onInsertFromUploadRequest( [ media ]: Partial< Attachment >[] ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			id: media.id,
			src: media.url,
		} );
	}

	return (
		<Fragment>
			<UploadIndicator
				id={ props.attributes.id }
				url={ props.attributes.src }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.src }
				onInsert={ onInsertRecording }
				recordingType="audio"
			/>
			{ ! props.attributes.src ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'audio' ] }
					accept={ [ 'audio/*' ] }
				/>
			) : null }
			{ ! props.attributes.id ? (
				<ImportMedia
					url={ props.attributes.src }
					onChange={ onImportMedia }
				/>
			) : null }
			<DebugInfo id={ props.attributes.id } />
		</Fragment>
	);
}
