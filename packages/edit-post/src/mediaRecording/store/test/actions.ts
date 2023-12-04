import { createRegistry } from '@wordpress/data';
import { type WPDataRegistry } from '@wordpress/data/build-types/registry';
import { store as blockEditorStore } from '@wordpress/block-editor';

import { store as recordingStore } from '../';
import { Type } from '../types';

function createRegistryWithStores() {
	// Create a registry and register used stores.
	const registry = createRegistry();
	// @ts-ignore
	[ recordingStore, blockEditorStore ].forEach( registry.register );
	return registry;
}

describe( 'actions', () => {
	let registry: WPDataRegistry;

	beforeEach( () => {
		registry = createRegistryWithStores();
	} );

	describe( 'setVideoInput', () => {
		it( `should return the ${ Type.ChangeVideoInput } action`, async () => {
			const result = await registry
				.dispatch( recordingStore )
				.setVideoInput( 'foobar' );

			expect( result ).toStrictEqual( {
				type: Type.ChangeVideoInput,
				deviceId: 'foobar',
			} );
		} );
	} );

	describe( 'setAudioInput', () => {
		it( `should return the ${ Type.ChangeAudioInput } action`, async () => {
			const result = await registry
				.dispatch( recordingStore )
				.setAudioInput( 'foobar' );

			expect( result ).toStrictEqual( {
				type: Type.ChangeAudioInput,
				deviceId: 'foobar',
			} );
		} );
	} );

	describe( 'toggleBlurEffect', () => {
		it( `should return the ${ Type.ToggleBlurVideoEffect } action`, async () => {
			const result = await registry
				.dispatch( recordingStore )
				.toggleBlurEffect();

			expect( result ).toStrictEqual( {
				type: Type.ToggleBlurVideoEffect,
			} );
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