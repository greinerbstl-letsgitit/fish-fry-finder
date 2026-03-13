"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatTime12hr(timeStr: string | null): string {
  if (!timeStr) return "—";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}${minutes ? `:${minutes.toString().padStart(2, "0")}` : ":00"} ${period}`;
}

function isWithinEventHours(
  eventDate: string,
  startTime: string | null,
  endTime: string | null,
  now: Date
): "open" | "before" | "after" {
  if (!startTime || !endTime) return "open";
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const openAt = new Date(eventDate);
  openAt.setHours(startH, startM, 0, 0);
  const closeAt = new Date(eventDate);
  closeAt.setHours(endH, endM, 0, 0);
  if (now < openAt) return "before";
  if (now > closeAt) return "after";
  return "open";
}

export type OrderNowButtonProps = {
  eventId: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  variant?: "card" | "page";
};

export function OrderNowButton({
  eventId,
  eventDate,
  startTime,
  endTime,
  variant = "card",
}: OrderNowButtonProps) {
  const [status, setStatus] = useState<"open" | "before" | "after" | null>(null);

  useEffect(() => {
    const now = new Date();
    setStatus(isWithinEventHours(eventDate, startTime, endTime, now));
  }, [eventDate, startTime, endTime]);

  // Before hydration, show disabled state to avoid layout shift (client time unknown)
  const effectiveStatus = status ?? "before";

  const baseBtn =
    variant === "page"
      ? "inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-bold uppercase tracking-wide shadow-md transition sm:px-10"
      : "inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-base font-bold uppercase tracking-wide shadow-md transition";

  if (effectiveStatus === "open") {
    return (
      <Link
        href={`/events/${eventId}/order`}
        className={`${baseBtn} bg-[#c9a227] text-[#1e3a5f] hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]`}
      >
        Order Now
      </Link>
    );
  }

  if (effectiveStatus === "before") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className={`${baseBtn} cursor-not-allowed bg-gray-300 text-gray-500`}
          aria-disabled="true"
        >
          Order Now
        </span>
        <span className="text-xs text-gray-500">
          Online ordering opens at {formatTime12hr(startTime)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`${baseBtn} cursor-not-allowed bg-gray-300 text-gray-500`}
        aria-disabled="true"
      >
        Order Now
      </span>
      <span className="text-xs text-gray-500">
        Online ordering has closed
      </span>
    </div>
  );
}
