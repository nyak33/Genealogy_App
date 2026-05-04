import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  profile: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma
}));

const { findPossibleDuplicateProfiles, searchProfiles } = await import(
  "@/lib/services/profile-service"
);

describe("profile service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array for empty or too-short search", async () => {
    await expect(searchProfiles("")).resolves.toEqual([]);
    await expect(searchProfiles("s")).resolves.toEqual([]);

    expect(mockPrisma.profile.findMany).not.toHaveBeenCalled();
  });

  it("searches case-insensitively against fullName and normalizedName", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([]);

    await searchProfiles("SHA");

    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              fullName: {
                contains: "SHA",
                mode: "insensitive"
              }
            },
            {
              normalizedName: {
                contains: "sha",
                mode: "insensitive"
              }
            }
          ]
        },
        take: 20
      })
    );
  });

  it("builds duplicate checks from normalized name and available dates", async () => {
    mockPrisma.profile.findMany.mockResolvedValueOnce([]);

    await findPossibleDuplicateProfiles({
      fullName: "  Amin   Rahman  ",
      dateOfBirth: "1980-03-20",
      dateOfDeath: null
    });

    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { normalizedName: "amin rahman" },
            { dateOfBirth: new Date("1980-03-20") }
          ])
        }),
        take: 10
      })
    );
  });
});
