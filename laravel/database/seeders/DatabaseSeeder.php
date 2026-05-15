<?php
namespace Database\Seeders;

class DatabaseSeeder extends Seeder {
  public function run(): void {
    $this->call([RoleSeeder::class, UserSeeder::class]);
  }
}
