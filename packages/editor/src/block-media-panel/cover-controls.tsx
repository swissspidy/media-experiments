/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';
import type { BlockEditProps } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { DebugInfo } from './debug-info';
import { MuteVideo } from './mute-video';
import { OptimizeMedia } from './optimize-media';
import { RecordingControls } from './recording-controls';
import type { CoverBlock } from './types';
import { UploadIndicator } from './upload-indicator';

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
				recordingTypes={ [ 'image', 'video' ] }
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
