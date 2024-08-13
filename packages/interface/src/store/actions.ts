/**
 * Internal dependencies
 */
import { type OpenModalAction, type CloseModalAction, Type } from './types';

/**
 * Returns an action object used in signalling that the user opened a modal.
 *
 * @param {string} name A string that uniquely identifies the modal.
 *
 * @return Action object.
 */
export function openModal( name: string ): OpenModalAction {
	return {
		type: Type.OpenModal,
		name,
	};
}

/**
 * Returns an action object signalling that the user closed a modal.
 *
 * @return Action object.
 */
export function closeModal(): CloseModalAction {
	return {
		type: Type.CloseModal,
	};
}
