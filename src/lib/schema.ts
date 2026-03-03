import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("CA_users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("gm"),
  name: text("name").notNull(),
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
  menuTbd: boolean("menu_tbd").default(false)
}, (table) => [
  index("idx_ca_orders_store").on(table.assignedStoreId),
  index("idx_ca_orders_status").on(table.status),
  index("idx_ca_orders_delivery_time").on(table.deliveryTime),
  index("idx_ca_orders_pickup_time").on(table.pickupTime),
  index("idx_ca_orders_created_at").on(table.createdAt),
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
  checklists: many(orderChecklists)
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
