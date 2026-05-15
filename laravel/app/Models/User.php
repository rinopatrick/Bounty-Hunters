<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;use Illuminate\Database\Eloquent\Builder;
class User extends Model {
protected $fillable=["name","email","role"];
protected static function booted():void{
static::creating(function(User $u){$u->role ??= "viewer";});
static::updated(function(User $u){if($u->wasChanged("email"))$u->markEmailAsUnverified();});}
public function scopeActive(Builder $q):Builder{return $q->whereNotNull("email_verified_at");}}}
