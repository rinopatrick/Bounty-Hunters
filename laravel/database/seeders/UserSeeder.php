<?php
namespace Database\Seeders;
class UserSeeder extends Seeder {
  public function run(): void {
    User::firstOrCreate(["email"=>"admin@example.com"],["name"=>"Admin","password"=>bcrypt("secret")]);
  }
}
