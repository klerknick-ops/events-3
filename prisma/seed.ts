import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { ensureEventDays } from "../lib/event-days";

const prisma = new PrismaClient();

// Build a Date for "today + dayOffset" at HH:mm local time.
function at(dayOffset: number, hh: number, mm = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
}

interface OrgSeed {
  name: string;
  slug: string;
  users: { email: string; name: string; role: string; password: string }[];
  full: boolean; // full demo dataset vs a lighter one
}

async function seedOrganization(cfg: OrgSeed) {
  console.log(`\nSeeding organization: ${cfg.name}`);
  const org = await prisma.organization.create({
    data: { name: cfg.name, slug: cfg.slug },
  });
  const oid = org.id;

  await prisma.user.createMany({
    data: cfg.users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      passwordHash: hashPassword(u.password),
      organizationId: oid,
    })),
  });
  const admin = await prisma.user.findUnique({ where: { email: cfg.users[0].email } });

  // Spaces
  const [ballroom, terrace, privateDining, meetingA] = await Promise.all([
    prisma.bookableSpace.create({ data: { organizationId: oid, name: "Grand Ballroom", capacity: 300, color: "#4f46e5", sortOrder: 1 } }),
    prisma.bookableSpace.create({ data: { organizationId: oid, name: "Garden Terrace", capacity: 120, color: "#059669", sortOrder: 2 } }),
    prisma.bookableSpace.create({ data: { organizationId: oid, name: "Private Dining Room", capacity: 24, color: "#d97706", sortOrder: 3 } }),
    prisma.bookableSpace.create({ data: { organizationId: oid, name: "Meeting Room A", capacity: 40, color: "#0284c7", sortOrder: 4 } }),
  ]);

  // Products (productType: GUEST for catering/per-guest items, EVENT for fixed gear/decor)
  const mk = (title: string, description: string, priceNet: number, taxRate: number, productType: string, imageUrl: string) =>
    prisma.product.create({ data: { organizationId: oid, title, description, priceNet, taxRate, productType, imageUrl } });
  const [welcomeDrinks, platedDinner, buffetLunch, winePairing, avPackage, coffeeBreak, floralCenterpiece, cakeService] =
    await Promise.all([
      mk("Welcome Drinks Reception", "Sparkling wine & canapés on arrival, per guest.", 18, 21, "GUEST", "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=70"),
      mk("Plated 3-Course Dinner", "Seasonal three-course plated dinner, per guest.", 68, 21, "GUEST", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=70"),
      mk("Buffet Lunch", "Hot & cold buffet lunch with dessert station, per guest.", 42, 21, "GUEST", "https://images.unsplash.com/photo-1555244162-803834f70033?w=400&q=70"),
      mk("Wine Pairing", "Sommelier-selected wine pairing, per guest.", 35, 21, "GUEST", "https://images.unsplash.com/photo-1510626176961-4b57d4fbad03?w=400&q=70"),
      mk("AV & PA Package", "Projector, screen, microphones and sound desk.", 450, 21, "EVENT", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&q=70"),
      mk("Coffee & Pastry Break", "Barista coffee, tea and pastries, per guest.", 12, 9, "GUEST", "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=70"),
      mk("Floral Centerpiece", "Seasonal floral centerpiece, per table.", 55, 9, "EVENT", "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400&q=70"),
      mk("Cake Cutting & Service", "Cake plating and table service.", 120, 9, "EVENT", "https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=400&q=70"),
    ]);

  // Setups (room layouts) per space, with threshold rules keyed off person count.
  const banquet = await prisma.setup.create({
    data: {
      spaceId: ballroom.id,
      name: "Banquet rounds",
      sortOrder: 1,
      rules: {
        create: [
          { minPersons: 1, tableCount: 1, sortOrder: 1, note: "Single round" },
          { minPersons: 19, tableCount: 2, sortOrder: 2, note: "Split to 2 tables" },
          { minPersons: 32, tableCount: 3, headTables: true, sortOrder: 3, note: "Add head/end tables" },
        ],
      },
    },
  });
  const ballroomTheatre = await prisma.setup.create({ data: { spaceId: ballroom.id, name: "Theatre", sortOrder: 2 } });
  const ceremonyRows = await prisma.setup.create({ data: { spaceId: terrace.id, name: "Ceremony rows", sortOrder: 1 } });
  const boardroom = await prisma.setup.create({ data: { spaceId: privateDining.id, name: "Boardroom", sortOrder: 1 } });
  await prisma.setup.create({ data: { spaceId: meetingA.id, name: "U-shape", sortOrder: 1 } });
  await prisma.setup.create({ data: { spaceId: meetingA.id, name: "Theatre", sortOrder: 2 } });

  // Payment terms presets
  const fiftyFifty = await prisma.paymentTerms.create({
    data: {
      organizationId: oid,
      name: "50% deposit / 50% on the day",
      depositPercent: 50,
      sortOrder: 1,
      body: "A 50% deposit is due on booking to confirm the reservation. The remaining 50% balance is payable on the day of the event.",
    },
  });
  await prisma.paymentTerms.create({
    data: {
      organizationId: oid,
      name: "25% deposit / net 14 after event",
      depositPercent: 25,
      sortOrder: 2,
      body: "A 25% deposit is due on booking. The remaining balance is invoiced after the event and payable within 14 days.",
    },
  });

  // Hotel rooms
  const [standardRoom, deluxeRoom, suite] = await Promise.all([
    prisma.hotelRoomType.create({ data: { organizationId: oid, title: "Standard Double", description: "Cozy double room with city view.", priceNet: 120, taxRate: 9, inventory: 20, imageUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=400&q=70" } }),
    prisma.hotelRoomType.create({ data: { organizationId: oid, title: "Deluxe King", description: "Spacious king room with balcony.", priceNet: 180, taxRate: 9, inventory: 10, imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&q=70" } }),
    prisma.hotelRoomType.create({ data: { organizationId: oid, title: "Junior Suite", description: "Separate living area and premium amenities.", priceNet: 280, taxRate: 9, inventory: 4, imageUrl: "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=400&q=70" } }),
  ]);

  // Settings
  await prisma.setting.create({
    data: {
      organizationId: oid,
      key: "cancellation_policy",
      value:
        "Cancellations more than 60 days before the event receive a full deposit refund. " +
        "Between 30 and 60 days: 50% of the quoted total. Within 30 days: non-refundable. " +
        "All cancellations must be made in writing.",
    },
  });

  // Task rules
  const ttContract = await prisma.taskTemplate.create({ data: { organizationId: oid, title: "Sign contract & take deposit", offsetDays: 0, basis: "BEFORE_CREATION", defaultAssignee: "Sales" } });
  const ttGuests = await prisma.taskTemplate.create({ data: { organizationId: oid, title: "Confirm final guest count", offsetDays: 7, basis: "BEFORE_EVENT", defaultAssignee: "Coordinator" } });
  const ttMenu = await prisma.taskTemplate.create({ data: { organizationId: oid, title: "Confirm menu & dietary requirements", offsetDays: 14, basis: "BEFORE_EVENT", defaultAssignee: "Kitchen" } });
  const ttInvoice = await prisma.taskTemplate.create({ data: { organizationId: oid, title: "Send final invoice", offsetDays: 3, basis: "BEFORE_EVENT", defaultAssignee: "Finance" } });

  // Event template
  await prisma.eventTemplate.create({
    data: {
      organizationId: oid,
      name: "Standard Wedding Package",
      description: "Ceremony on the terrace followed by a plated dinner reception in the ballroom.",
      slots: {
        create: [
          { label: "Ceremony", spaceId: terrace.id, startTime: "14:00", durationMin: 90, sortOrder: 1 },
          { label: "Dinner & Reception", spaceId: ballroom.id, startTime: "18:00", durationMin: 300, sortOrder: 2 },
        ],
      },
      products: { create: [{ productId: welcomeDrinks.id, quantity: 80 }, { productId: platedDinner.id, quantity: 80 }, { productId: cakeService.id, quantity: 1 }] },
      tasks: { create: [{ taskTemplateId: ttContract.id, sortOrder: 1 }, { taskTemplateId: ttMenu.id, sortOrder: 2 }, { taskTemplateId: ttGuests.id, sortOrder: 3 }, { taskTemplateId: ttInvoice.id, sortOrder: 4 }] },
    },
  });

  // Clients
  const acme = await prisma.company.create({ data: { organizationId: oid, name: "Acme Industries", email: "events@acme.example" } });
  const sarah = await prisma.contact.create({ data: { organizationId: oid, firstName: "Sarah", lastName: "Mitchell", email: "sarah.m@example.com" } });
  const james = await prisma.contact.create({ data: { organizationId: oid, firstName: "James", lastName: "Okafor", email: "j.okafor@acme.example", companyId: acme.id } });

  // Attach products to a specific slot (Phase 3: products live under slots).
  const attach = (eventId: string, slotId: string, items: { productId: string; quantity: number }[]) =>
    prisma.eventProduct.createMany({
      data: items.map((it) => ({ eventId, slotId, productId: it.productId, quantity: it.quantity })),
    });

  // Events
  const wedding = await prisma.event.create({
    data: {
      organizationId: oid,
      title: "Mitchell–Brown Wedding",
      status: "CONFIRMED",
      notes: "Outdoor ceremony; weather backup in ballroom.",
      contactId: sarah.id,
      paymentTermsId: fiftyFifty.id,
      timeSlots: {
        create: [
          { label: "Ceremony", spaceId: terrace.id, startsAt: at(0, 14, 0), endsAt: at(0, 15, 30), sortOrder: 1, personCount: 80, setupId: ceremonyRows.id },
          { label: "Dinner & Reception", spaceId: ballroom.id, startsAt: at(0, 18, 0), endsAt: at(0, 23, 0), sortOrder: 2, personCount: 80, setupId: banquet.id, setupTableCount: 8, setupHeadTables: true },
        ],
      },
      roomBookings: { create: [{ roomTypeId: standardRoom.id, quantity: 8, checkIn: at(0, 15), checkOut: at(1, 11) }, { roomTypeId: suite.id, quantity: 1, checkIn: at(0, 15), checkOut: at(2, 11) }] },
      tasks: { create: [{ title: "Confirm final guest count", assignee: "Coordinator", dueDate: at(-2, 12), completed: true }, { title: "Technical / AV check", assignee: "Tech", dueDate: at(-1, 9) }] },
    },
    include: { timeSlots: { orderBy: { sortOrder: "asc" } } },
  });
  await attach(wedding.id, wedding.timeSlots[1].id, [
    { productId: welcomeDrinks.id, quantity: 80 },
    { productId: platedDinner.id, quantity: 80 },
    { productId: floralCenterpiece.id, quantity: 8 },
    { productId: cakeService.id, quantity: 1 },
  ]);
  if (admin) {
    await prisma.eventNote.create({
      data: {
        eventId: wedding.id,
        authorId: admin.id,
        body: "Client prefers vegetarian options for the head table.",
      },
    });
  }

  if (cfg.full) {
    const lunch = await prisma.event.create({
      data: {
        organizationId: oid,
        title: "Acme Q3 Strategy Lunch",
        status: "TENTATIVE",
        contactId: james.id,
        paymentTermsId: fiftyFifty.id,
        timeSlots: { create: [{ label: "Lunch", spaceId: privateDining.id, startsAt: at(0, 12, 0), endsAt: at(0, 14, 0), sortOrder: 1, personCount: 18, setupId: boardroom.id }] },
        tasks: { create: [{ title: "Confirm final guest count", assignee: "Coordinator", dueDate: at(-3, 12) }] },
      },
      include: { timeSlots: true },
    });
    await attach(lunch.id, lunch.timeSlots[0].id, [
      { productId: buffetLunch.id, quantity: 18 },
      { productId: coffeeBreak.id, quantity: 18 },
    ]);

    const conf = await prisma.event.create({
      data: {
        organizationId: oid,
        title: "Horizon Investor Conference",
        status: "CONFIRMED",
        contactId: james.id,
        paymentTermsId: fiftyFifty.id,
        timeSlots: {
          create: [
            { label: "Day 1 — Main Conference", spaceId: ballroom.id, startsAt: at(1, 9, 0), endsAt: at(1, 17, 0), sortOrder: 1, personCount: 120, setupId: ballroomTheatre.id },
            { label: "Day 2 — Workshops", spaceId: ballroom.id, startsAt: at(2, 9, 0), endsAt: at(2, 13, 0), sortOrder: 2, personCount: 120, setupId: ballroomTheatre.id },
          ],
        },
      },
      include: { timeSlots: { orderBy: { sortOrder: "asc" } } },
    });
    await attach(conf.id, conf.timeSlots[0].id, [
      { productId: avPackage.id, quantity: 1 },
      { productId: coffeeBreak.id, quantity: 120 },
      { productId: buffetLunch.id, quantity: 120 },
    ]);
  }

  // Activity entries + day backfill
  const events = await prisma.event.findMany({ where: { organizationId: oid }, select: { id: true } });
  for (const e of events) {
    await ensureEventDays(e.id);
    if (admin) {
      await prisma.activityLog.create({ data: { organizationId: oid, eventId: e.id, userId: admin.id, action: "EVENT_CREATED", summary: "Created the event" } });
    }
  }

  console.log(`  ✓ ${cfg.name}: ${cfg.users.length} users, ${events.length} events`);
}

async function main() {
  console.log("Resetting data…");
  // Explicit dependency order — EventTimeSlot→BookableSpace is Restrict, so we
  // can't rely on Organization cascade alone.
  await prisma.session.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.eventNote.deleteMany();
  await prisma.eventProduct.deleteMany();
  await prisma.eventRoomBooking.deleteMany();
  await prisma.task.deleteMany();
  await prisma.eventTimeSlot.deleteMany();
  await prisma.eventDay.deleteMany();
  await prisma.event.deleteMany();
  await prisma.templateProduct.deleteMany();
  await prisma.templateTask.deleteMany();
  await prisma.templateSlot.deleteMany();
  await prisma.eventTemplate.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.product.deleteMany();
  await prisma.hotelRoomType.deleteMany();
  await prisma.bookableSpace.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Seeding platform admin…");
  await prisma.user.create({
    data: {
      email: "platform@sirevents.com",
      name: "Platform Owner",
      role: "ADMIN",
      isPlatformAdmin: true,
      passwordHash: hashPassword("platform123"),
    },
  });

  await seedOrganization({
    name: "Grand Plaza Hotel",
    slug: "grand-plaza",
    full: true,
    users: [
      { email: "admin@venue.com", name: "Alex Admin", role: "ADMIN", password: "admin123" },
      { email: "manager@venue.com", name: "Morgan Manager", role: "MANAGER", password: "manager123" },
      { email: "staff@venue.com", name: "Sam Staff", role: "STAFF", password: "staff123" },
    ],
  });

  await seedOrganization({
    name: "The Riverside Venue",
    slug: "riverside",
    full: false,
    users: [
      { email: "admin@riverside.com", name: "Robin Rivers", role: "ADMIN", password: "admin123" },
      { email: "staff@riverside.com", name: "Casey Brook", role: "STAFF", password: "staff123" },
    ],
  });

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
