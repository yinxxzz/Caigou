export default function WorkArea({ children }: { children: React.ReactNode }) {
  return (
    <main className="ml-64 min-h-screen bg-gray-50 p-8">
      {children}
    </main>
  );
}
