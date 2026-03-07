import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("CA_users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("gm"),
  name: text("name").notNull(),
  email: text("email").unique(),
  supabaseUid: text("supabase_uid").unique(),
  storeId: integer("store_id"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow()
});

export const stores = pgTable("CA_stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow()
});

export const orders = pgTable("CA_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  organization: text("organization"),
  items: jsonb("items").notNull().$type<OrderItem[]>(),
  totalAmount: integer("total_amount"),
  orderSource: text("order_source"),
  pickupTime: timestamp("pickup_time"),
  deliveryTime: timestamp("delivery_time"),
  readyTime: timestamp("ready_time"),
  deliveryAddress: text("delivery_address"),
  deliveryMode: text("delivery_mode").default("pickup"),
  status: text("status").notNull().default("new"),
  prepStatus: text("prep_status").default("new"),
  notes: text("notes"),
  utensilsRequested: boolean("utensils_requested").default(false),
  numberOfGuests: integer("number_of_guests"),
  assignedStoreId: integer("assigned_store_id"),
  assignedGmId: integer("assigned_gm_id"),
  assignedDriver: text("assigned_driver"),
  photoProofUrl: text("photo_proof_url"),
  pdfUrl: text("pdf_url"),
  labelsUrl: text("labels_url"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  menuTbd: boolean("menu_tbd").default(false),
  // Tracking fields
  trackingToken: text("tracking_token").unique(),
  assignedDriverId: integer("assigned_driver_id"),
  trackingMilestone: text("tracking_milestone").default("confirmed"),
  estimatedArrival: timestamp("estimated_arrival"),
}, (table) => [
  index("idx_ca_orders_store").on(table.assignedStoreId),
  index("idx_ca_orders_status").on(table.status),
  index("idx_ca_orders_delivery_time").on(table.deliveryTime),
  index("idx_ca_orders_pickup_time").on(table.pickupTime),
  index("idx_ca_orders_created_at").on(table.createdAt),
  index("idx_ca_orders_tracking_token").on(table.trackingToken),
]);

export const orderChecklists = pgTable("CA_order_checklists", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  taskName: text("task_name").notNull(),
  taskType: text("task_type").notNull(),
  forRole: text("for_role").default("admin"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  index("idx_ca_checklists_order").on(table.orderId),
]);

export const pushSubscriptions = pgTable("CA_push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Tracking milestone history — audit trail for each status change
export const trackingHistory = pgTable("CA_tracking_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  milestone: text("milestone").notNull(), // confirmed, preparing, packed, en_route, arriving, delivered
  triggeredBy: integer("triggered_by"), // user_id who triggered
  triggeredAt: timestamp("triggered_at").defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("idx_ca_tracking_history_order").on(table.orderId),
]);

// Driver GPS locations — high-frequency writes for live tracking
export const driverLocations = pgTable("CA_driver_locations", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull(),
  orderId: integer("order_id"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracy: doublePrecision("accuracy"),
  heading: doublePrecision("heading"),
  speed: doublePrecision("speed"),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  index("idx_ca_driver_locations_driver").on(table.driverId),
  index("idx_ca_driver_locations_order").on(table.orderId),
]);

export const appSettings = pgTable("CA_app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const usersRelations = relations(users, ({ one }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id]
  })
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.assignedStoreId],
    references: [stores.id]
  }),
  gm: one(users, {
    fields: [orders.assignedGmId],
    references: [users.id]
  }),
  driver: one(users, {
    fields: [orders.assignedDriverId],
    references: [users.id],
    relationName: "orderDriver"
  }),
  checklists: many(orderChecklists),
  trackingHistory: many(trackingHistory),
}));

export const trackingHistoryRelations = relations(trackingHistory, ({ one }) => ({
  order: one(orders, {
    fields: [trackingHistory.orderId],
    references: [orders.id]
  }),
  triggeredByUser: one(users, {
    fields: [trackingHistory.triggeredBy],
    references: [users.id]
  })
}));

export const driverLocationsRelations = relations(driverLocations, ({ one }) => ({
  driver: one(users, {
    fields: [driverLocations.driverId],
    references: [users.id]
  }),
  order: one(orders, {
    fields: [driverLocations.orderId],
    references: [orders.id]
  })
}));

export const orderChecklistsRelations = relations(orderChecklists, ({ one }) => ({
  order: one(orders, {
    fields: [orderChecklists.orderId],
    references: [orders.id]
  }),
  completedByUser: one(users, {
    fields: [orderChecklists.completedBy],
    references: [users.id]
  })
}));

export interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderChecklist = typeof orderChecklists.$inferSelect;
export type InsertOrderChecklist = typeof orderChecklists.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
export type TrackingHistory = typeof trackingHistory.$inferSelect;
export type InsertTrackingHistory = typeof trackingHistory.$inferInsert;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type InsertDriverLocation = typeof driverLocations.$inferInsert;

// Tracking milestone enum (customer-facing — used by public tracking page)
export const TRACKING_MILESTONES = [
  "confirmed",
  "preparing",
  "packed",
  "en_route",
  "arriving",
  "delivered",
] as const;
export type TrackingMilestone = typeof TRACKING_MILESTONES[number];

// Unified stages — single source of truth for internal + customer progress
export const UNIFIED_STAGES = [
  "new",
  "confirmed",
  "cooking",
  "ready",
  "en_route",
  "arriving",
  "delivered",
] as const;
export type UnifiedStage = typeof UNIFIED_STAGES[number];

// Maps unified stage → customer-facing tracking milestone (null = no customer update)
export const STAGE_TO_MILESTONE: Record<string, string | null> = {
  new: null,
  confirmed: "confirmed",
  cooking: "preparing",
  ready: "packed",
  en_route: "en_route",
  arriving: "arriving",
  delivered: "delivered",
};

// Maps unified stage → internal prepStatus value
export const STAGE_TO_PREP: Record<string, string> = {
  new: "new",
  confirmed: "confirmed",
  cooking: "cooking",
  ready: "ready",
  en_route: "ready",
  arriving: "ready",
  delivered: "delivered",
};

// Maps unified stage → top-level order status
export const STAGE_TO_STATUS: Record<string, string> = {
  new: "new",
  confirmed: "new",
  cooking: "prep",
  ready: "ready",
  en_route: "ready",
  arriving: "ready",
  delivered: "delivered",
};

// Reverse map: tracking milestone → unified stage (for reading current stage from DB)
export const MILESTONE_TO_STAGE: Record<string, string> = {
  confirmed: "confirmed",
  preparing: "cooking",
  packed: "ready",
  en_route: "en_route",
  arriving: "arriving",
  delivered: "delivered",
};
