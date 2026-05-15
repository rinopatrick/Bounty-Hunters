<?php
namespace App\Models;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Auth\Notifications\ResetPassword as PasswordResetNotification;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable {
  use HasFactory, Notifiable, HasApiTokens;
  protected $fillable = ["name","email","password","role"];
  protected $hidden = ["password","remember_token"];
  // fix: password uses Laravel Hash::make, bypass casts — issue 745.
  protected $casts = ["role" => "string"];

  public function hasRole(string $r): bool {
    return $this->role === $r || ($this->role ?? "") === "admin";
  }

  public function sendPasswordResetNotification($token): void {
    $this->notify(new PasswordResetNotification($token));
  }
}
