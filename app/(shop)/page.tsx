export default function HomePage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Phân Bón";
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-bold">{siteName}</h1>
    </main>
  );
}
