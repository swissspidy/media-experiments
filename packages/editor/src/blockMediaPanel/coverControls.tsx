import type { Attachment } from '@mexp/media-utils';

import { Fragment } from '@wordpress/element';
import type { BlockEditProps } from '@wordpress/blocks';

import { DebugInfo } from './debugInfo';
import { MuteVideo } from './muteVideo';
import { OptimizeMedia } from './optimizeMedia';
import { RecordingControls } from './recordingControls';
import type { CoverBlock } from './types';
import { UploadIndicator } from './uploadIndicator';

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
				recordingTypes={ [ 'image' ] }
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
