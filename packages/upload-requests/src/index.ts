import ShortUniqueId from 'short-unique-id';

export { Modal } from './modal';

export function getUniqueId() {
	const uid = new ShortUniqueId( { length: 8 } );
	return uid.rnd();
}
