export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-16">
      {children}
    </main>
  );
}
