import { NextResponse } from "next/server";
import {
  getProfileById,
  ProfileNotFoundError,
  updateProfile
} from "@/lib/services/profile-service";
import { updateProfileSchema } from "@/lib/validators/profile";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const profile = await getProfileById(id);

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Unable to load profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const result = updateProfileSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid profile data",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const profile = await updateProfile(id, result.data);

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to update profile";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
