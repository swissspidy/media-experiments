import { type BlockEditProps } from '@wordpress/blocks';
import { Fragment } from '@wordpress/element';

import { type Attachment } from '@mexp/upload-media';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { ImportMedia } from './importMedia';
import type { AudioBlock } from './types';

type AudioControlsProps = AudioBlock &
	Pick< BlockEditProps< AudioBlock[ 'attributes' ] >, 'setAttributes' >;

export function AudioControls( props: AudioControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
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

	return (
		<Fragment>
			<UploadIndicator
				id={ props.attributes.id }
				url={ props.attributes.url }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.url }
				onInsert={ onInsertRecording }
			/>
			{ ! props.attributes.id ? (
				<ImportMedia
					url={ props.attributes.url }
					onChange={ onChange }
				/>
			) : null }
		</Fragment>
	);
}
