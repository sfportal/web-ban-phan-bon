import { SITE_NAME } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-bold">{SITE_NAME}</h1>
    </main>
  );
}
