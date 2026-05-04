import { NextResponse } from "next/server";
import { getProfileById, ProfileNotFoundError } from "@/lib/services/profile-service";
import {
  getProfileRelationships,
  RelationshipInputError
} from "@/lib/services/relationship-service";
import { profileRelationshipParamsSchema } from "@/lib/validators/relationship";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const result = profileRelationshipParamsSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid profile ID",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    await getProfileById(result.data.id);
    const relationships = await getProfileRelationships(result.data.id);

    return NextResponse.json({ relationships });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof RelationshipInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to load relationships" },
      { status: 500 }
    );
  }
}
