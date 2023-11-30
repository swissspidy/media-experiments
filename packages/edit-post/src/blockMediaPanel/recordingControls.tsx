import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store as recordingStore } from '../mediaRecording/store';

interface RecordingControlsProps {
	url?: string;
	clientId: string;
}

export function RecordingControls( { url, clientId }: RecordingControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { enterRecordingMode, leaveRecordingMode } =
		useDispatch( recordingStore );

	const isInRecordingMode = useSelect(
		( select ) => select( recordingStore ).isInRecordingMode(),
		[]
	);

	const onClick = () => {
		if ( isInRecordingMode ) {
			void leaveRecordingMode();
		} else {
			void enterRecordingMode( clientId );
		}
	};

	if ( url ) {
		return null;
	}

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Self Recording', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					"Use your device's camera and microphone to record video, audio, or take a still picture",
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ isInRecordingMode
					? __( 'Exit', 'media-experiments' )
					: __( 'Start', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
