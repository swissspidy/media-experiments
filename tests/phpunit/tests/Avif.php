<?php

class Avif_Test extends WP_UnitTestCase {
	public function test_filter_mimes_to_exts(): void {
		if ( PHP_VERSION_ID < 80100 ) {
			$this->markTestSkipped( 'Needs further investigation on PHP 8.0' );
		}

		$result = \MediaExperiments\filter_mimes_to_exts( [] );
		$this->assertArrayHasKey( 'image/avif', $result );
		$this->assertSame( 'avif', $result['image/avif'] );

		$actual = wp_check_filetype_and_ext( DIR_PLUGIN_TESTDATA . '/media/fox.avif', 'fox.avif' );
		$this->assertSameSetsWithIndex(
			[
				'ext'             => 'avif',
				'type'            => 'image/avif',
				'proper_filename' => false,
			],
			$actual
		);
	}

	public function test_filter_mime_types(): void {
		$result = \MediaExperiments\filter_mime_types( [] );
		$this->assertArrayHasKey( 'avif', $result );
		$this->assertSame( 'image/avif', $result['avif'] );

		$actual = wp_get_mime_types();
		$this->assertArrayHasKey( 'avif', $actual );
	}

	public function test_filter_ext_types(): void {
		$result = \MediaExperiments\filter_ext_types( [ 'image' => [ 'jpeg', 'png' ] ] );
		$this->assertArrayHasKey( 'image', $result );
		$this->assertSameSets( [ 'jpeg', 'png', 'avif' ], $result['image'] );

		$actual = wp_get_ext_types();
		$this->assertArrayHasKey( 'image', $actual );
		$this->assertContains( 'avif', $actual['image'] );
	}

	/**
	 * @requires PHP 8.1
	 */
	public function test_filter_file_is_displayable_image() {
		if ( PHP_VERSION_ID < 80100 ) {
			$this->markTestSkipped( 'Needs further investigation on PHP 8.0' );
		}

		$actual = file_is_displayable_image( DIR_PLUGIN_TESTDATA . '/media/fox.avif' );
		$this->assertTrue( $actual );
		$actual = MediaExperiments\filter_file_is_displayable_image( false, DIR_PLUGIN_TESTDATA . '/media/fox.avif' );
		$this->assertTrue( $actual );
	}
}
