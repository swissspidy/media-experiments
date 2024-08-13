/**
 * WordPress dependencies
 */
import { createRegistry } from '@wordpress/data';
import { type WPDataRegistry } from '@wordpress/data/build-types/registry';

/**
 * Internal dependencies
 */
import { store as interfaceStore } from '../';
import { Type } from '../types';

function createRegistryWithStores() {
	// Create a registry and register used stores.
	const registry = createRegistry();
	// @ts-ignore
	[ interfaceStore ].forEach( registry.register );
	return registry;
}

describe( 'actions', () => {
	let registry: WPDataRegistry;

	beforeEach( () => {
		registry = createRegistryWithStores();
	} );

	describe( 'openModal', () => {
		it( `should return the ${ Type.OpenModal } action`, async () => {
			const result = await registry
				.dispatch( interfaceStore )
				.openModal( 'foo' );

			expect( result ).toStrictEqual( {
				type: Type.OpenModal,
				name: 'foo',
			} );

			expect(
				registry.select( interfaceStore ).isModalActive( 'foo' )
			).toBe( true );
			expect(
				registry.select( interfaceStore ).isModalActive( 'bar' )
			).toBe( false );
		} );
	} );

	describe( 'closeModal', () => {
		it( `should return the ${ Type.CloseModal } action`, async () => {
			await registry.dispatch( interfaceStore ).openModal( 'foo' );
			const result = await registry
				.dispatch( interfaceStore )
				.closeModal();

			expect( result ).toStrictEqual( {
				type: Type.CloseModal,
			} );
			expect(
				registry.select( interfaceStore ).isModalActive( 'foo' )
			).toBe( false );
		} );
	} );
} );
