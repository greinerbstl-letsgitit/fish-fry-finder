import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Get In Touch
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-blue-100">
            Have a question or want to list your fish fry? We would love to
            hear from you.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
          <h2 className="text-xl font-bold text-[#1e3a5f]">Contact</h2>
          <dl className="mt-4 space-y-3 text-gray-700">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="text-base font-medium text-gray-900">
                Brett Greiner
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd>
                <a
                  href="mailto:greinerbstl@gmail.com"
                  className="text-base font-medium text-[#1e3a5f] underline decoration-[#2d5a87]/50 underline-offset-2 hover:text-[#2d5a87]"
                >
                  greinerbstl@gmail.com
                </a>
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm text-gray-600">
            We typically respond within 24 hours.
          </p>

          <div className="mt-8">
            <Link
              href="/admin/signup"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#c9a227] px-6 py-4 text-base font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f] sm:w-auto"
            >
              List Your Fish Fry
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
