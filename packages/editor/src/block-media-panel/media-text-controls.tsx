/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { DebugInfo } from './debug-info';
import { MuteVideo } from './mute-video';
import { OptimizeMedia } from './optimize-media';
import { RecordingControls } from './recording-controls';
import type { MediaTextBlock } from './types';
import { UploadIndicator } from './upload-indicator';

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
		<>
			<UploadIndicator
				id={ props.attributes.mediaId }
				url={ props.attributes.mediaUrl }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.mediaUrl }
				onInsert={ onInsertRecording }
				recordingTypes={ [ 'image', 'video' ] }
			/>
			<OptimizeMedia
				id={ props.attributes.mediaId }
				url={ props.attributes.mediaUrl }
				onSuccess={ onChange }
			/>
			{ 'video' === props.attributes.mediaType ? (
				<MuteVideo
					id={ props.attributes.mediaId }
					url={ props.attributes.mediaUrl }
					onChange={ onChange }
				/>
			) : null }
			<DebugInfo id={ props.attributes.mediaId } />
		</>
	);
}
