<?php
namespace App\Policies;
use App\Models\Role;use App\Models\User;
class RolePolicy{public function viewAny(User $u):bool{return $u->can('view_roles');}
public function view(User $u,Role $r):bool{return $u->can('view_role');}
public function create(User $u):bool{return $u->can('create_role');}
public function update(User $u,Role $r):bool{return $u->can('update_role');}
public function delete(User $u,Role $r):bool{return $u->can('delete_role');}}
