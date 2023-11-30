import { type BlockEditProps } from '@wordpress/blocks';
import { Fragment } from '@wordpress/element';

import { type Attachment } from '@mexp/upload-media';

import { UploadIndicator } from './uploadIndicator';
import { RecordingControls } from './recordingControls';
import { ImportMedia } from './importMedia';
import { OptimizeMedia } from './optimizeMediaProps';
import { MuteVideo } from './muteVideo';
import { GenerateSubtitles } from './generateSubtitles';
import { RestorePoster } from './restorePosterProps';
import { DebugInfo } from './debugInfo';
import type { VideoBlock } from './types';

type VideoControlsProps = VideoBlock &
	Pick< BlockEditProps< VideoBlock[ 'attributes' ] >, 'setAttributes' >;

export function VideoControls( props: VideoControlsProps ) {
	function onImportMedia( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}

		props.setAttributes( {
			src: media.url,
			id: media.id,
			poster: media.image?.src,
			// TODO: What did I mean with `media.icon` here?
			// poster: media.image?.src !== media.icon ? media.image?.src : undefined,
			caption: media.caption,
		} );
	}

	function onOptimizeMedia( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			id: media.id,
			src: media.url,
		} );
	}

	function onMuteVideo( media: Partial< Attachment > ) {
		if ( ! media || ! media.url ) {
			return;
		}
		props.setAttributes( {
			id: media.id,
			src: media.url,
			muted: true,
		} );
	}

	function onInsertRecording( url?: string ) {
		if ( url ) {
			props.setAttributes( {
				src: url,
			} );
		}
	}

	return (
		<Fragment>
			<UploadIndicator
				id={ props.attributes.id }
				url={ props.attributes.src }
				poster={ props.attributes.poster }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.src }
				onInsert={ onInsertRecording }
			/>
			{ ! props.attributes.id ? (
				<ImportMedia
					url={ props.attributes.src }
					onChange={ onImportMedia }
				/>
			) : null }
			<OptimizeMedia
				id={ props.attributes.id }
				poster={ props.attributes.poster }
				onSuccess={ onOptimizeMedia }
			/>
			<MuteVideo
				id={ props.attributes.id }
				url={ props.attributes.src }
				poster={ props.attributes.poster }
				onChange={ onMuteVideo }
			/>
			<GenerateSubtitles { ...props } />
			<RestorePoster { ...props } />
			<DebugInfo id={ props.attributes.id } />
		</Fragment>
	);
}
