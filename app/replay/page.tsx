import Link from "next/link";
import ReplayPanel from "@/components/replay/ReplayPanel";
export const metadata = { title: "Production Replay | CryptoBot" };
export default function ReplayPage() {
  return (
    <main
      lang="es"
      className="dark [color-scheme:dark] min-h-screen bg-[#0a0a0f] text-white"
    >
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800/60 px-3 sm:px-6 py-3">
        <nav
          aria-label="Navegación principal"
          className="flex items-center gap-6 text-sm"
        >
          <Link href="/" className="font-bold text-base">
            CryptoBot
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white">
            Dashboard
          </Link>
          <Link href="/signals" className="text-gray-400 hover:text-white">
            Señales
          </Link>
          <Link href="/research" className="text-gray-400 hover:text-white">
            Research Lab
          </Link>
          <span aria-current="page" className="text-emerald-400">
            Replay
          </span>
        </nav>
      </header>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        <ReplayPanel />
      </div>
    </main>
  );
}
