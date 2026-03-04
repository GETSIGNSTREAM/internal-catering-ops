import { notFound } from "next/navigation";

// Public tracking page — no auth required
// Will be implemented with the Catering Tracker System
export default function TrackingPage({
  params,
}: {
  params: { trackingId: string };
}) {
  // Placeholder: tracking system not yet implemented
  notFound();
}
