import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";

const customerSteps = [
  "Find a fish fry near you",
  "Browse the menu",
  "Place your order online",
  "Pay in person when you arrive",
];

const faqs = [
  {
    q: "Is this free?",
    a: "Yes, completely free for both customers and organizations.",
  },
  {
    q: "Do we need special equipment?",
    a: "Just a phone, tablet, or computer to view incoming orders.",
  },
  {
    q: "How do customers pay?",
    a: "Payment is handled in person at the event.",
  },
  {
    q: "What if we run out of something?",
    a: "You can mark items as unavailable in real time from your dashboard.",
  },
  {
    q: "Who do I contact for help?",
    a: "Contact Brett Greiner at greinerbstl@gmail.com.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            About Fish Fry Finder
          </h1>
          <p className="mt-3 max-w-3xl text-blue-100">
            Welcome! We are proud to support Catholic and Christian communities
            by making it easier for families and neighbors to find local fish
            fry events and order with confidence.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold text-[#1e3a5f]">About</h2>
          <p className="mt-3 text-gray-700">
            Fish Fry Finder is a free platform connecting Catholic and Christian
            communities with their local fish fry events. People can browse
            menus and place orders online for pickup or dine-in, with payment
            handled in person at the event.
          </p>
        </section>

        <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold text-[#1e3a5f]">
            How It Works (For Customers)
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-gray-700">
            {customerSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold text-[#1e3a5f]">For Organizers</h2>
          <p className="mt-3 text-gray-700">
            Listing your fish fry is completely free. Organizers get their own
            dashboard to manage menus and view incoming orders in real time.
            Ready to join?{" "}
            <Link
              href="/admin/signup"
              className="font-semibold text-[#1e3a5f] underline decoration-[#2d5a87]/50 underline-offset-2 hover:text-[#2d5a87]"
            >
              Sign up here
            </Link>
            .
          </p>
        </section>

        <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
          <h2 className="text-xl font-bold text-[#1e3a5f]">FAQ</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-[#1e3a5f]">{item.q}</h3>
                <p className="mt-1 text-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
