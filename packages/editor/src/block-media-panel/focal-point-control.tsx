/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { FocalPointPicker, Button, Notice } from '@wordpress/components';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect, useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */

interface FocalPoint {
	x: number;
	y: number;
}

interface FocalPointControlProps {
	id: number;
	url: string;
}

export function FocalPointControl( { id, url }: FocalPointControlProps ) {
	const [ focalPoint, setFocalPoint ] = useState< FocalPoint >( {
		x: 0.5,
		y: 0.5,
	} );
	const [ error, setError ] = useState< string | null >( null );
	const [ success, setSuccess ] = useState< boolean >( false );
	const [ hasChanged, setHasChanged ] = useState( false );

	const { editEntityRecord, saveEditedEntityRecord } =
		useDispatch( coreStore );

	const { mediaFocalPoint, isLoading, isSaving } = useSelect(
		( select ) => {
			// @ts-ignore
			const { getEntityRecord, isResolving, isSavingEntityRecord } =
				select( coreStore );
			const attachment = getEntityRecord( 'postType', 'attachment', id );

			return {
				mediaFocalPoint: attachment?.meta?.mexp_focal_point,
				isLoading: isResolving( 'getEntityRecord', [
					'postType',
					'attachment',
					id,
				] ),
				isSaving: isSavingEntityRecord( 'postType', 'attachment', id ),
			};
		},
		[ id ]
	);

	useEffect( () => {
		if ( mediaFocalPoint && ! hasChanged ) {
			setFocalPoint( mediaFocalPoint );
		}
	}, [ mediaFocalPoint, hasChanged ] );

	if ( ! id || ! url || isLoading ) {
		return null;
	}

	const handleFocalPointChange = ( newFocalPoint: FocalPoint ) => {
		setFocalPoint( newFocalPoint );
		setHasChanged( true );
		setError( null );
		setSuccess( false );
	};

	const handleSave = async () => {
		try {
			setError( null );
			setSuccess( false );

			// Save the focal point to the attachment
			await editEntityRecord( 'postType', 'attachment', id, {
				meta: {
					mexp_focal_point: focalPoint,
				},
			} );

			await saveEditedEntityRecord( 'postType', 'attachment', id );

			setHasChanged( false );
			setSuccess( true );
		} catch {
			setError(
				__(
					'Failed to save focal point. Please try again.',
					'media-experiments'
				)
			);
		}
	};

	const handleReset = () => {
		const defaultFocalPoint = { x: 0.5, y: 0.5 };
		setFocalPoint( defaultFocalPoint );
		setHasChanged( true );
		setError( null );
		setSuccess( false );
	};

	return (
		<div className="mexp-focal-point-control">
			<FocalPointPicker
				__nextHasNoMarginBottom
				label={ __( 'Focal point', 'media-experiments' ) }
				url={ url }
				value={ focalPoint }
				onChange={ handleFocalPointChange }
				help={ __(
					'Set the focal point for thumbnail cropping. This will be used for future thumbnails generated from this image.',
					'media-experiments'
				) }
			/>

			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }

			{ success && (
				<Notice
					status="success"
					isDismissible={ true }
					onRemove={ () => setSuccess( false ) }
				>
					{ __(
						'Focal point saved successfully. Note: This will affect future thumbnail generation, not existing thumbnails.',
						'media-experiments'
					) }
				</Notice>
			) }

			<div
				style={ {
					display: 'flex',
					gap: '8px',
					marginTop: '12px',
					flexWrap: 'wrap',
				} }
			>
				<Button
					variant="primary"
					onClick={ handleSave }
					disabled={ ! hasChanged || isSaving }
					isBusy={ isSaving }
				>
					{ __( 'Save focal point', 'media-experiments' ) }
				</Button>

				<Button
					variant="secondary"
					onClick={ handleReset }
					disabled={ isSaving }
				>
					{ __( 'Reset to center', 'media-experiments' ) }
				</Button>
			</div>
		</div>
	);
}
