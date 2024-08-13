/**
 * Internal dependencies
 */
import type { State } from './types';

/**
 * Returns true if a modal is active, or false otherwise.
 *
 * @param {Object} state     Global application state.
 * @param {string} modalName A string that uniquely identifies the modal.
 *
 * @return Whether the modal is active.
 */
export function isModalActive( state: State, modalName: string ): boolean {
	return state.activeModal === modalName;
}
