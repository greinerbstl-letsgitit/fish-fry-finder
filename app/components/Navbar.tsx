import Link from "next/link";

export function Navbar() {
  return (
    <nav className="mx-auto max-w-4xl border-b border-[#2d5a87]/60 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-white hover:text-amber-200 transition"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-white hover:text-amber-200 transition"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="text-sm font-medium text-white hover:text-amber-200 transition"
          >
            Contact
          </Link>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/admin/login"
            className="text-sm font-medium text-white hover:text-amber-200 transition"
          >
            Sign In
          </Link>
          <Link
            href="/admin/signup"
            className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]"
          >
            List Your Fish Fry
          </Link>
        </div>
      </div>
    </nav>
  );
}
