// Lightweight client-facing types mirroring API responses.
import type { EventStatus, TaskDeadlineBasis } from "./enums";

export interface Space {
  id: string;
  name: string;
  capacity: number | null;
  color: string;
  sortOrder: number;
  archived: boolean;
}

// EVENT  → always quantity 1 regardless of attendance (e.g. a microphone, a screen)
// GUEST  → quantity defaults to the slot's person count, fully adjustable afterward
export type ProductType = "EVENT" | "GUEST";

export interface Product {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceNet: number;
  taxRate: number;
  productType: ProductType;
  archived: boolean;
}

export interface SetupRule {
  id: string;
  setupId: string;
  minPersons: number;
  tableCount: number | null;
  headTables: boolean;
  note: string | null;
  sortOrder: number;
}

export interface Setup {
  id: string;
  spaceId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
  rules?: SetupRule[];
}

export interface PaymentTerms {
  id: string;
  name: string;
  depositPercent: number | null;
  body: string;
  sortOrder: number;
  archived: boolean;
}

export interface RoomType {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceNet: number;
  taxRate: number;
  inventory: number;
  archived: boolean;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
  title: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  _count?: { contacts: number };
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  companyId: string | null;
  company?: Company | null;
  _count?: { events: number };
}

export type NotificationTargetType = "SPACE" | "PRODUCT" | "SETUP";

export interface NotificationRule {
  id: string;
  targetType: NotificationTargetType;
  message: string;
  minPersons: number | null;
  productId: string | null;
  setupId: string | null;
  active: boolean;
  spaces: { spaceId: string; space?: { id: string; name: string } }[];
}

export type TaskTriggerType = "RELATIVE" | "RECURRING" | "ACTION";
export type TaskRecurrenceFreq = "WEEKLY" | "MONTHLY";
export type TaskActionType = "EMAIL_RECEIVED" | "EMAIL_SENT" | "STATUS_CHANGE";

export interface TaskTemplate {
  id: string;
  title: string;
  defaultAssignee: string | null;
  assignedUserId: string | null;
  triggerType: TaskTriggerType;
  offsetDays: number;
  basis: TaskDeadlineBasis;
  recurrenceFreq: TaskRecurrenceFreq | null;
  recurrenceWeekday: number | null;
  recurrenceDay: number | null;
  recurrenceOrdinal: number | null;
  actionType: TaskActionType | null;
  actionStatus: string | null;
  leadDays: number;
}

export interface TemplateSlot {
  id: string;
  spaceId: string | null;
  space?: Space | null;
  label: string | null;
  startTime: string;
  durationMin: number;
  dayOffset: number;
  sortOrder: number;
  products?: TemplateProduct[];
}

export interface TemplateProduct {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  templateSlotId?: string | null;
}

export interface TemplateTask {
  id: string;
  taskTemplateId: string;
  taskTemplate: TaskTemplate;
  sortOrder: number;
}

export interface EventTemplate {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  slots?: TemplateSlot[];
  products?: TemplateProduct[];
  tasks?: TemplateTask[];
  _count?: { slots: number; products: number; tasks: number };
}

export interface EventDay {
  id: string;
  eventId: string;
  date: string;
  label: string | null;
  sortOrder: number;
}

export interface TimeSlot {
  id: string;
  eventId: string;
  dayId: string | null;
  spaceId: string;
  space?: Space;
  label: string | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  personCount: number;
  setupId: string | null;
  setup?: Setup | null;
  setupTableCount: number | null;
  setupHeadTables: boolean;
  setupManual: boolean;
  notes: string | null;
}

export interface EventProduct {
  id: string;
  productId: string;
  product: Product;
  dayId: string | null;
  slotId: string | null;
  slot?: TimeSlot | null;
  quantity: number;
  nameOverride: string | null;
  unitPriceNetOverride: number | null;
  taxRateOverride: number | null;
  notes: string | null;
}

export interface RoomBooking {
  id: string;
  eventId: string;
  roomTypeId: string;
  roomType: RoomType;
  quantity: number;
  checkIn: string;
  checkOut: string;
  notes: string | null;
}

export interface Task {
  id: string;
  eventId: string | null;
  emailMessageId?: string | null;
  title: string;
  assignee: string | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string } | null;
  dueDate: string | null;
  completed: boolean;
  event?: {
    id: string;
    title: string;
    status: EventStatus;
    contact: {
      firstName: string;
      lastName: string;
      company: { name: string } | null;
    };
  } | null;
  emailMessage?: { id: string; subject: string; fromAddress: string } | null;
}

export interface EventNote {
  id: string;
  eventId: string;
  authorId: string | null;
  author?: { id: string; name: string } | null;
  body: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  eventId: string | null;
  userId: string | null;
  user?: { id: string; name: string } | null;
  action: string;
  summary: string;
  createdAt: string;
  event?: { id: string; title: string } | null;
}

export type EmailLabel = "VENDOR" | "SUPPLIER";

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface EmailMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  fromAddress: string;
  fromName: string | null;
  toAddresses: string;
  ccAddresses: string | null;
  subject: string;
  bodyPreview: string | null;
  body: string;
  bodyIsHtml: boolean;
  receivedAt: string;
  isRead: boolean;
  label: EmailLabel | null;
  contactId: string | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
  eventId: string | null;
  event?: { id: string; title: string; assignedUser?: { id: string; name: string } | null } | null;
  autoMatched: boolean;
  ownerId: string | null;
  owner?: { id: string; name: string } | null;
  archivedAt?: string | null;
  attachments?: EmailAttachment[];
}

export interface InboxResponse {
  configured: boolean;
  mailbox: string | null;
  counts: { client: number; leadsInbox: number; leadsSent: number; archived: number };
  messages: EmailMessage[];
}

export interface EventFull {
  id: string;
  title: string;
  status: EventStatus;
  notes: string | null;
  contactId: string;
  templateId: string | null;
  contact: Contact;
  template?: { id: string; name: string } | null;
  paymentTermsId: string | null;
  paymentTerms?: PaymentTerms | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string } | null;
  days: EventDay[];
  timeSlots: TimeSlot[];
  products: EventProduct[];
  roomBookings: RoomBooking[];
  tasks: Task[];
  createdAt: string;
}

export interface TimelineSlot {
  id: string;
  spaceId: string;
  label: string | null;
  startsAt: string;
  endsAt: string;
  space: Space;
  event: {
    id: string;
    title: string;
    status: EventStatus;
    contact: {
      firstName: string;
      lastName: string;
      company: { name: string } | null;
    };
  };
}
