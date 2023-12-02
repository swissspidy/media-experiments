import {
	getRecordingType,
	isBlockInRecordingMode,
	isInRecordingMode,
} from '../selectors';
import type { State } from '../types';

describe( 'selectors', () => {
	describe( 'isInRecordingMode', () => {
		it( 'should return false by default', () => {
			const state: State = {
				videoInput: undefined,
				audioInput: undefined,
				videoEffect: 'none',
				blockClientId: undefined,
				recordingType: 'video',
				devices: [],
				hasAudio: true,
				isGifMode: false,
				countdown: 0,
				duration: 0,
				recordingStatus: 'idle',
				mediaChunks: [],
			};

			expect( isInRecordingMode( state ) ).toBe( false );
		} );
	} );

	describe( 'isBlockInRecordingMode', () => {
		it( 'should return false by default', () => {
			const state: State = {
				videoInput: undefined,
				audioInput: undefined,
				videoEffect: 'none',
				blockClientId: 'foo',
				recordingType: 'video',
				devices: [],
				hasAudio: true,
				isGifMode: false,
				countdown: 0,
				duration: 0,
				recordingStatus: 'idle',
				mediaChunks: [],
			};

			expect( isBlockInRecordingMode( state, 'bar' ) ).toBe( false );
		} );
	} );

	describe( 'getRecordingType', () => {
		it( 'should return video by default', () => {
			const state: State = {
				videoInput: undefined,
				audioInput: undefined,
				videoEffect: 'none',
				blockClientId: undefined,
				recordingType: 'video',
				devices: [],
				hasAudio: true,
				isGifMode: false,
				countdown: 0,
				duration: 0,
				recordingStatus: 'idle',
				mediaChunks: [],
			};

			expect( getRecordingType( state ) ).toBe( 'video' );
		} );
	} );
} );
