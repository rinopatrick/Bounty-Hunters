<?php
namespace App\Observers;
use App\Models\User;
class UserObserver {
public function creating(User $u):void{
if($u->role===""){$u->role="viewer";}}
public function updated(User $u):void{
if($u->wasChanged("email"))$u->sendEmailVerification();}}
