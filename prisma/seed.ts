import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Seed the three intro courses and a handful of sample identities so both sides
// of the app are usable before CAS exists. These sample users stand in for
// CAS-authenticated netIDs; once CAS lands, real users are provisioned instead.
async function main() {
  const courses = [
    { code: "COS126", name: "General Computer Science" },
    { code: "COS217", name: "Introduction to Programming Systems" },
    { code: "COS226", name: "Algorithms and Data Structures" },
  ];
  for (const c of courses) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }

  const users: { netid: string; name: string; role: "STUDENT" | "TA" | "ADMIN" }[] = [
    { netid: "student1", name: "Alex Student", role: "STUDENT" },
    { netid: "student2", name: "Blake Student", role: "STUDENT" },
    { netid: "student3", name: "Casey Student", role: "STUDENT" },
    { netid: "ta1", name: "Dana TA", role: "TA" },
    { netid: "ta2", name: "Eli TA", role: "TA" },
    { netid: "admin1", name: "Fran Admin", role: "ADMIN" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { netid: u.netid },
      update: { name: u.name, role: u.role },
      create: { ...u, email: `${u.netid}@princeton.edu` },
    });
  }

  console.log(`Seeded ${courses.length} courses and ${users.length} users.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
