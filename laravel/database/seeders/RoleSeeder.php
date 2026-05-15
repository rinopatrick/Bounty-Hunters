<?php
namespace Database\Seeders;
use App\Models\Role;
class RoleSeeder extends Seeder {
  public function run(): void {
    collect(["admin","editor","viewer"])->each(fn($r)=>Role::firstOrCreate(["slug"=>$r],["name"=>ucfirst($r)]));
  }
}
