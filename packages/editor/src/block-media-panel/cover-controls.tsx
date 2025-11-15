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
import { RecordingControls } from './recording-controls';
import type { CoverBlock } from '../types';
import { UploadIndicator } from './upload-indicator';
import { BulkOptimization } from '../components/bulk-optimization';
import { useBlockAttachments } from '../utils/hooks';
import { UploadRequestControls } from './upload-requests/controls';

type CoverControlsProps = CoverBlock &
	Pick< BlockEditProps< CoverBlock[ 'attributes' ] >, 'setAttributes' >;

export function CoverControls( props: CoverControlsProps ) {
	const attachments = useBlockAttachments( props.clientId );

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

	function onInsertFromUploadRequest( [ media ]: Partial< Attachment >[] ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			id: media.id,
			url: media.url,
		} );
	}

	return (
		<>
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
			{ ! props.attributes.url ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'image', 'video' ] }
					accept={ [ 'image/*', 'video/*' ] }
				/>
			) : null }
			<BulkOptimization attachments={ attachments } />
			{ 'video' === props.attributes.backgroundType ? (
				<MuteVideo
					id={ props.attributes.id }
					url={ props.attributes.url }
					onChange={ onChange }
				/>
			) : null }
			<DebugInfo id={ props.attributes.id } />
		</>
	);
}
