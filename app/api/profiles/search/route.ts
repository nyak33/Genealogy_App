import { NextResponse } from "next/server";
import { searchProfiles } from "@/lib/services/profile-service";
import { profileSearchQuerySchema } from "@/lib/validators/profile";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = profileSearchQuerySchema.safeParse({
    q: searchParams.get("q") ?? ""
  });

  if (!result.success) {
    return NextResponse.json([], { status: 400 });
  }

  const profiles = await searchProfiles(result.data.q);

  return NextResponse.json(profiles);
}
