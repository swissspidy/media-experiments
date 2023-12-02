import {
	getDevices,
	getRecordingType,
	hasAudio,
	hasVideo,
	isBlockInRecordingMode,
	isGifMode,
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

	describe( 'getDevices', () => {
		it( 'should return empty array by default', () => {
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

			expect( getDevices( state ) ).toStrictEqual( [] );
		} );
	} );

	describe( 'isGifMode', () => {
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

			expect( isGifMode( state ) ).toBe( false );
		} );
	} );

	describe( 'hasVideo', () => {
		it( 'should return true by default', () => {
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

			expect( hasVideo( state ) ).toBe( true );
		} );
	} );

	describe( 'hasAudio', () => {
		it( 'should return true by default', () => {
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

			expect( hasAudio( state ) ).toBe( true );
		} );
	} );
} );
