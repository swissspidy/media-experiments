import { Fragment } from '@wordpress/element';
import { type BlockEditProps } from '@wordpress/blocks';

import { type Attachment } from '@mexp/upload-media';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { ImportMedia } from './importMedia';
import { OptimizeMedia } from './optimizeMediaProps';
import { DebugInfo } from './debugInfo';
import type { ImageBlock } from './types';

type ImageControlsProps = ImageBlock &
	Pick< BlockEditProps< ImageBlock[ 'attributes' ] >, 'setAttributes' >;

export function ImageControls( props: ImageControlsProps ) {
	function onChange( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
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
			<OptimizeMedia
				id={ props.attributes.id }
				url={ props.attributes.url }
				onSuccess={ onOptimizeMedia }
			/>
			<DebugInfo id={ props.attributes.id } />
		</Fragment>
	);
}
