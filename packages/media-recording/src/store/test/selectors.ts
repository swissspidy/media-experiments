import {
	getAudioInput,
	getDevices,
	getRecordingTypes,
	getVideoEffect,
	getVideoInput,
	hasAudio,
	hasVideo,
	isBlockInRecordingMode,
	isGifMode,
	isInRecordingMode,
} from '../selectors';
import type { State } from '../types';

const defaultState: State = {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	blockClientId: undefined,
	recordingTypes: [ 'video' ],
	devices: [],
	hasAudio: true,
	isGifMode: false,
	countdown: 0,
	duration: 0,
	recordingStatus: 'idle',
	mediaChunks: [],
};

describe( 'selectors', () => {
	describe( 'isInRecordingMode', () => {
		it( 'should return false by default', () => {
			expect( isInRecordingMode( defaultState ) ).toBe( false );
		} );
	} );

	describe( 'isBlockInRecordingMode', () => {
		it( 'should return false if wrong clientId', () => {
			const state: State = {
				...defaultState,
				blockClientId: 'foo',
			};

			expect( isBlockInRecordingMode( state, 'bar' ) ).toBe( false );
		} );

		it( 'should return true if right clientId', () => {
			const state: State = {
				...defaultState,
				blockClientId: 'foo',
			};

			expect( isBlockInRecordingMode( state, 'foo' ) ).toBe( true );
		} );
	} );

	describe( 'getRecordingTypes', () => {
		it( 'should return video by default', () => {
			expect( getRecordingTypes( defaultState ) ).toStrictEqual( [ 'video' ] );
		} );
	} );

	describe( 'getDevices', () => {
		it( 'should return empty array by default', () => {
			expect( getDevices( defaultState ) ).toStrictEqual( [] );
		} );
	} );

	describe( 'isGifMode', () => {
		it( 'should return false by default', () => {
			expect( isGifMode( defaultState ) ).toBe( false );
		} );
	} );

	describe( 'hasVideo', () => {
		it( 'should return true by default', () => {
			expect( hasVideo( defaultState ) ).toBe( true );
		} );
	} );

	describe( 'hasAudio', () => {
		it( 'should return true by default', () => {
			expect( hasAudio( defaultState ) ).toBe( true );
		} );
	} );

	describe( 'getVideoInput', () => {
		it( 'should return video input', () => {
			const state: State = {
				...defaultState,
				videoInput: 'foo',
			};

			expect( getVideoInput( state ) ).toBe( 'foo' );
		} );
	} );
	describe( 'getAudioInput', () => {
		it( 'should return video input', () => {
			const state: State = {
				...defaultState,
				audioInput: 'foo',
			};

			expect( getAudioInput( state ) ).toBe( 'foo' );
		} );
	} );
	describe( 'getVideoEffect', () => {
		it( 'should return none by default', () => {
			expect( getVideoEffect( defaultState ) ).toBe( 'none' );
		} );

		it( 'should return blur', () => {
			const state: State = {
				...defaultState,
				videoEffect: 'blur',
			};

			expect( getVideoEffect( state ) ).toBe( 'blur' );
		} );
	} );
} );
