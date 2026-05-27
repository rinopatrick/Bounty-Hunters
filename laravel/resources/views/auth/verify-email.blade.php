<x-layout title="Verify Email">
  <div class="max-w-md mx-auto mt-12">
    <h1 class="text-2xl font-bold mb-4">Verify Your Email</h1>
    <p class="text-gray-700">
      If your email matches our records and is verified,
      <br/>you may now close this page.
    </p>
    @if($verificationUrl)
      <a href="{{ $verificationUrl }}" class="btn-primary mt-4 inline-block">
        Complete Verification
      </a>
    @endif
  </div>
</x-layout>
