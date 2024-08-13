/**
 * WordPress dependencies
 */
import { createRegistry } from '@wordpress/data';
import type { WPDataRegistry } from '@wordpress/data/build-types/registry';

/**
 * Internal dependencies
 */
import { store as recordingStore } from '../';
import { Type } from '../types';

function createRegistryWithStores() {
	// Create a registry and register used stores.
	const registry = createRegistry();
	// @ts-ignore
	[ recordingStore ].forEach( registry.register );
	return registry;
}

describe( 'actions', () => {
	let registry: WPDataRegistry;

	beforeEach( () => {
		registry = createRegistryWithStores();
	} );

	describe( 'setVideoInput', () => {
		it( 'changes the video input', async () => {
			await registry.dispatch( recordingStore ).setVideoInput( 'foobar' );

			expect(
				registry.select( recordingStore ).getVideoInput()
			).toStrictEqual( 'foobar' );
		} );
	} );

	describe( 'setAudioInput', () => {
		it( 'changes the audio input', async () => {
			await registry.dispatch( recordingStore ).setAudioInput( 'foobar' );

			expect(
				registry.select( recordingStore ).getAudioInput()
			).toStrictEqual( 'foobar' );
		} );
	} );

	describe( 'toggleBlurEffect', () => {
		it( 'toggles the blur effect', async () => {
			await registry.dispatch( recordingStore ).toggleBlurEffect();

			expect(
				registry.select( recordingStore ).getVideoEffect()
			).toStrictEqual( 'blur' );

			await registry.dispatch( recordingStore ).toggleBlurEffect();

			expect(
				registry.select( recordingStore ).getVideoEffect()
			).toStrictEqual( 'none' );

			await registry.dispatch( recordingStore ).toggleBlurEffect();

			expect(
				registry.select( recordingStore ).getVideoEffect()
			).toStrictEqual( 'blur' );
		} );
	} );

	describe( 'toggleGifMode', () => {
		it( `should return the ${ Type.ToggleGifMode } action`, async () => {
			const result = await registry
				.dispatch( recordingStore )
				.toggleGifMode();

			expect( result ).toStrictEqual( {
				type: Type.ToggleGifMode,
			} );
		} );
	} );
	describe( 'toggleHasAudio', () => {
		it( `should return the ${ Type.ToggleHasAudio } action`, async () => {
			const result = await registry
				.dispatch( recordingStore )
				.toggleHasAudio();

			expect( result ).toStrictEqual( {
				type: Type.ToggleHasAudio,
			} );
		} );
	} );
} );
