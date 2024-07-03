type Action< T = Type, Payload = {} > = {
	type: T;
} & Payload;

export interface State {
	activeModal?: string | null;
}

export enum Type {
	Unknown = 'REDUX_UNKNOWN',
	OpenModal = 'OPEN_MODAL',
	CloseModal = 'CLOSE_MODAL',
}

export type UnknownAction = Action< Type.Unknown >;
export type OpenModalAction = Action< Type.OpenModal, { name: string } >;
export type CloseModalAction = Action< Type.CloseModal >;
