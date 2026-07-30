import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/api";
import { createSession, verifyCredentials } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const user = await verifyCredentials(email, password);

    // Same message either way — don't leak which emails exist.
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
