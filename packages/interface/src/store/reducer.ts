/**
 * Internal dependencies
 */
import type {
	CloseModalAction,
	OpenModalAction,
	State,
	UnknownAction,
} from './types';
import { Type } from './types';

const DEFAULT_STATE: State = {
	activeModal: undefined,
};

type Action = UnknownAction | OpenModalAction | CloseModalAction;

function reducer( state = DEFAULT_STATE, action: Action ) {
	switch ( action.type ) {
		case Type.OpenModal:
			return {
				...state,
				activeModal: action.name,
			};

		case Type.CloseModal:
			return {
				...state,
				activeModal: null,
			};
	}

	return state;
}

export default reducer;
