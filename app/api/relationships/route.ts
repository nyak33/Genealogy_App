import { NextResponse } from "next/server";
import {
  createRelationship,
  RelationshipConflictError,
  RelationshipInputError
} from "@/lib/services/relationship-service";
import { createRelationshipSchema } from "@/lib/validators/relationship";

export async function POST(request: Request) {
  const body = await request.json();
  const result = createRelationshipSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Invalid relationship data",
        issues: result.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const relationship = await createRelationship(result.data);

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    if (
      error instanceof RelationshipInputError ||
      error instanceof RelationshipConflictError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to create relationship" },
      { status: 500 }
    );
  }
}
