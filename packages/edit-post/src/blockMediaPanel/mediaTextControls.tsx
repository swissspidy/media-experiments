import { type BlockEditProps } from '@wordpress/blocks';
import { type Attachment } from '@mexp/upload-media';
import { Fragment } from '@wordpress/element';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { OptimizeMedia } from './optimizeMedia';
import { MuteVideo } from './muteVideo';
import { DebugInfo } from './debugInfo';
import type { MediaTextBlock } from './types';

type MediaTextControlsProps = MediaTextBlock &
	Pick< BlockEditProps< MediaTextBlock[ 'attributes' ] >, 'setAttributes' >;

export function MediaTextControls( props: MediaTextControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			mediaUrl: media.url,
			mediaId: media.id,
		} );
	}

	function onInsertRecording( url?: string ) {
		if ( url ) {
			props.setAttributes( {
				mediaUrl: url,
			} );
		}
	}

	return (
		<Fragment>
			<UploadIndicator
				id={ props.attributes.mediaId }
				url={ props.attributes.mediaUrl }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.mediaUrl }
				onInsert={ onInsertRecording }
			/>
			<OptimizeMedia
				id={ props.attributes.mediaId }
				url={ props.attributes.mediaUrl }
				onSuccess={ onChange }
			/>
			{ 'video' === props.attributes.mediaType ? (
				<>
					<MuteVideo
						id={ props.attributes.mediaId }
						url={ props.attributes.mediaUrl }
						onChange={ onChange }
					/>
				</>
			) : null }
			<DebugInfo id={ props.attributes.mediaId } />
		</Fragment>
	);
}
