/**
 * External dependencies
 */
import type { Attachment } from '@mexp/media-utils';

/**
 * WordPress dependencies
 */
import type { BlockEditProps } from '@wordpress/blocks';
import { isBlobURL } from '@wordpress/blob';

/**
 * Internal dependencies
 */
import { UploadIndicator } from './upload-indicator';
import { RecordingControls } from './recording-controls';
import { ImportMedia } from './import-media';
import { MuteVideo } from './mute-video';
import { GenerateSubtitles } from './generate-subtitles';
import { AddPoster } from './add-poster';
import { DebugInfo } from './debug-info';
import type { VideoBlock } from '../types';
import { UploadRequestControls } from './upload-requests/controls';
import { GifLooper } from './gif-looper';

type VideoControlsProps = VideoBlock &
	Pick< BlockEditProps< VideoBlock[ 'attributes' ] >, 'setAttributes' >;

export function VideoControls( props: VideoControlsProps ) {
	function onImportMedia( media: Partial< Attachment > ) {
		// Ignore blob URLs as otherwise the block tries to upload it again.
		if ( ! media || ! media.url || isBlobURL( media.url ) ) {
			return;
		}

		props.setAttributes( {
			src: media.url,
			id: media.id,
			poster: media.poster,
			caption: media.caption,
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
		<>
			<GifLooper attributes={ props.attributes } />
			<UploadIndicator
				id={ props.attributes.id }
				url={ props.attributes.src }
				poster={ props.attributes.poster }
			/>
			<RecordingControls
				clientId={ props.clientId }
				url={ props.attributes.src }
				onInsert={ onInsertRecording }
				recordingTypes={ [ 'video' ] }
			/>
			{ ! props.attributes.src ? (
				<UploadRequestControls
					onInsert={ onInsertFromUploadRequest }
					allowedTypes={ [ 'video' ] }
					accept={ [ 'video/*' ] }
				/>
			) : null }
			{ ! props.attributes.id ? (
				<ImportMedia
					url={ props.attributes.src }
					onChange={ onImportMedia }
					allowedTypes={ [ 'video' ] }
				/>
			) : null }
			<MuteVideo
				id={ props.attributes.id }
				url={ props.attributes.src }
				poster={ props.attributes.poster }
				onChange={ onMuteVideo }
			/>
			<GenerateSubtitles { ...props } />
			<AddPoster { ...props } />
			<DebugInfo id={ props.attributes.id } />
		</>
	);
}
