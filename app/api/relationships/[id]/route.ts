import { NextResponse } from "next/server";
import {
  deleteRelationship,
  RelationshipNotFoundError
} from "@/lib/services/relationship-service";
import { relationshipIdSchema } from "@/lib/validators/relationship";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const params = await context.params;
  const result = relationshipIdSchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid relationship ID",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    await deleteRelationship(result.data.id);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RelationshipNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Unable to delete relationship" },
      { status: 500 }
    );
  }
}
