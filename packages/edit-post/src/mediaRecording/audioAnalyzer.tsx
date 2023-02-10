import { useEffect, useRef, useState } from '@wordpress/element';

function AudioVisualiser( { data } ) {
	const canvasRef = useRef< HTMLCanvasElement >();
	const canvas = canvasRef.current;

	if ( canvas ) {
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;

		const height = canvas.height;
		const width = canvas.width;
		const context = canvas.getContext( '2d' );

		if ( context ) {
			context.lineWidth = 2;
			context.strokeStyle = '#000';
			context.clearRect( 0, 0, width, height );

			context.beginPath();
			context.moveTo( 0, height / 2 );

			const sliceWidth = Number( width ) / data.length;

			let x = 0;
			for ( const item of data ) {
				const y = ( item / 255.0 ) * height;
				context.lineTo( x, y );
				x += sliceWidth;
			}
			context.lineTo( x, height / 2 );
			context.stroke();
		}
	}

	return <canvas ref={ canvasRef } />;
}

interface AudioAnalyzerProps {
	source: MediaStream;
}

function AudioAnalyzer( { source }: AudioAnalyzerProps ) {
	const [ data, setData ] = useState< Uint8Array >( new Uint8Array( [] ) );
	const raf = useRef< number >();
	const audioContextRef = useRef< AudioContext >();
	const analyzerRef = useRef< AnalyserNode >();
	const prevRafTime = useRef< number >();

	useEffect( () => {
		if ( ! analyzerRef.current ) {
			const audioContext = new AudioContext();
			audioContextRef.current = audioContext;
			analyzerRef.current = audioContext.createAnalyser();
		}
	}, [] );

	useEffect( () => {
		if ( source.getAudioTracks().length === 0 ) {
			return;
		}

		const audioContext = audioContextRef.current;

		if ( ! audioContext ) {
			return;
		}

		const analyzer = analyzerRef.current;

		if ( ! analyzer ) {
			return;
		}

		const audioNode = audioContext.createMediaStreamSource( source );
		audioNode.connect( analyzer );

		const tick = ( time: DOMHighResTimeStamp ) => {
			if ( prevRafTime.current !== undefined ) {
				const dataArray = new Uint8Array( analyzer.frequencyBinCount );
				analyzer.getByteTimeDomainData( dataArray );
				setData( dataArray );
			}
			prevRafTime.current = time;
			raf.current = requestAnimationFrame( tick );
		};

		raf.current = requestAnimationFrame( tick );

		const requestId = raf.current;

		return () => {
			if ( requestId ) {
				cancelAnimationFrame( requestId );
			}
			analyzer.disconnect();
			audioNode.disconnect();
		};
	}, [ source ] );

	return (
		<div>
			<AudioVisualiser data={ data } />
		</div>
	);
}

export default AudioAnalyzer;
