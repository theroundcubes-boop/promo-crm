import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase is not configured. Service role key or URL missing." },
      { status: 503 }
    );
  }

  try {
    const { email, password } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user with email pre-confirmed to avoid rate-limiting issues on transactional emails
    const { data, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    const newUser = data.user;
    if (!newUser) {
      return NextResponse.json(
        { error: "Failed to create user account." },
        { status: 500 }
      );
    }

    // Automatically create the user's settings row:
    // Default exchange rate 88, alert threshold 85, auto_pause OFF (false), channel email
    const { error: settingsError } = await admin.from("settings").insert({
      user_id: newUser.id,
      usd_to_inr: 88.0,
      alert_threshold_percent: 85.0,
      auto_pause: false,
      notification_channel: "email",
    });

    if (settingsError) {
      console.error("[Auth Signup] Failed to initialize user settings:", settingsError);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during signup." },
      { status: 500 }
    );
  }
}
