import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { subscription } = body;

    // Validate subscription object
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Subscription endpoint is required" },
        { status: 400 }
      );
    }

    if (!subscription.endpoint.startsWith("https://")) {
      return NextResponse.json(
        { error: "Subscription endpoint must use HTTPS" },
        { status: 400 }
      );
    }

    if (
      !subscription.keys ||
      !subscription.keys.p256dh ||
      !subscription.keys.auth
    ) {
      return NextResponse.json(
        { error: "Subscription keys (p256dh and auth) are required" },
        { status: 400 }
      );
    }

    if (
      typeof subscription.keys.p256dh !== "string" ||
      subscription.keys.p256dh.length < 10
    ) {
      return NextResponse.json(
        { error: "Invalid p256dh key" },
        { status: 400 }
      );
    }

    if (
      typeof subscription.keys.auth !== "string" ||
      subscription.keys.auth.length < 10
    ) {
      return NextResponse.json(
        { error: "Invalid auth key" },
        { status: 400 }
      );
    }

    const userId = parseInt(auth.session.user.id, 10);

    const saved = await storage.createPushSubscription({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json(
      { error: "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
