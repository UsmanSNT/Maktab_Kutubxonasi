import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[#1e3a8a]">Kirish</h1>
        <p className="mt-2 text-[#3f3f46]">Maktab kodi va ID raqamingiz bilan kiring</p>
      </div>
      <LoginForm />
    </main>
  );
}
