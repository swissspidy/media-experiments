<?php

class Plugin_Test extends WP_UnitTestCase {
	public function test_get_all_image_sizes() {
		$sizes = MediaExperiments\get_all_image_sizes();
		$this->assertNotEmpty( $sizes );
		foreach ( $sizes as $size ) {
			$this->assertIsInt( $size['width'] );
			$this->assertIsInt( $size['height'] );
			$this->assertIsString( $size['name'] );
		}
	}

	public function test_add_quarter_hourly_cron_interval() {
		$schedules = wp_get_schedules();
		$this->assertArrayHasKey( 'quarter_hourly', $schedules );
	}
}
