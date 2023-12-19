import { type Attachment } from '@mexp/upload-media';

import { Fragment } from '@wordpress/element';
import { type BlockEditProps } from '@wordpress/blocks';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { OptimizeMedia } from './optimizeMedia';
import { MuteVideo } from './muteVideo';
import { DebugInfo } from './debugInfo';
import type { CoverBlock } from './types';

type CoverControlsProps = CoverBlock &
	Pick< BlockEditProps< CoverBlock[ 'attributes' ] >, 'setAttributes' >;

export function CoverControls( props: CoverControlsProps ) {
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
				recordingType="image"
			/>
			<OptimizeMedia
				id={ props.attributes.id }
				url={ props.attributes.url }
				onSuccess={ onChange }
			/>
			{ 'video' === props.attributes.backgroundType ? (
				<MuteVideo
					id={ props.attributes.id }
					url={ props.attributes.url }
					onChange={ onChange }
				/>
			) : null }
			<DebugInfo id={ props.attributes.id } />
		</Fragment>
	);
}
