import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Contact = {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface ConsolidatedContact {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: ConsolidatedContact;
}

async function getCluster(primaryId: number): Promise<Contact[]> {
  const [primary, secondaries] = await Promise.all([
    prisma.contact.findUnique({ where: { id: primaryId } }),
    prisma.contact.findMany({
      where: { linkedId: primaryId, deletedAt: null },
    }),
  ]);
  return primary ? [primary, ...secondaries] : secondaries;
}

async function resolvePrimary(contact: Contact): Promise<Contact> {
  if (contact.linkPrecedence === "primary") return contact;
  if (!contact.linkedId) return contact;

  const parent = await prisma.contact.findUnique({
    where: { id: contact.linkedId },
  });
  if (!parent) return contact;
  return resolvePrimary(parent);
}

async function buildResponse(primaryId: number): Promise<IdentifyResponse> {
  const cluster = await getCluster(primaryId);
  const primary = cluster.find((c: Contact) => c.id === primaryId)!;

  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const contact of cluster) {
    if (contact.id === primaryId) continue;
    secondaryContactIds.push(contact.id);
    if (contact.email && !emails.includes(contact.email)) {
      emails.push(contact.email);
    }
    if (contact.phoneNumber && !phoneNumbers.includes(contact.phoneNumber)) {
      phoneNumbers.push(contact.phoneNumber);
    }
  }

  return {
    contact: {
      primaryContatctId: primaryId,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

export async function identify(req: IdentifyRequest): Promise<IdentifyResponse> {
  const { email, phoneNumber } = req;

  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber must be provided");
  }

  const matchingContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    },
  });

  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkPrecedence: "primary",
      },
    });
    return buildResponse(newContact.id);
  }

  const primaries: Contact[] = await Promise.all(
    matchingContacts.map((c: Contact) => resolvePrimary(c))
  );

  const uniquePrimaries: Contact[] = Array.from(
    new Map(primaries.map((p: Contact) => [p.id, p])).values()
  );

  uniquePrimaries.sort(
    (a: Contact, b: Contact) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const truePrimary: Contact = uniquePrimaries[0];

  if (uniquePrimaries.length > 1) {
    const toMerge = uniquePrimaries.slice(1);

    for (const oldPrimary of toMerge as Contact[]) {
      await prisma.contact.update({
        where: { id: oldPrimary.id },
        data: {
          linkPrecedence: "secondary",
          linkedId: truePrimary.id,
          updatedAt: new Date(),
        },
      });

      await prisma.contact.updateMany({
        where: { linkedId: oldPrimary.id, deletedAt: null },
        data: {
          linkedId: truePrimary.id,
          updatedAt: new Date(),
        },
      });
    }
  }

  const allCluster = await getCluster(truePrimary.id);
  const clusterEmails = new Set(
    allCluster.map((c: Contact) => c.email).filter(Boolean)
  );
  const clusterPhones = new Set(
    allCluster.map((c: Contact) => c.phoneNumber).filter(Boolean)
  );

  const hasNewEmail = email && !clusterEmails.has(email);
  const hasNewPhone = phoneNumber && !clusterPhones.has(phoneNumber);

  if (hasNewEmail || hasNewPhone) {
    await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: truePrimary.id,
        linkPrecedence: "secondary",
      },
    });
  }

  return buildResponse(truePrimary.id);
}

export { prisma };