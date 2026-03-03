import { z } from "zod";

export const CreateOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").max(100),
  customerEmail: z.string().email().max(100).optional().nullable(),
  customerPhone: z.string().max(20).optional().nullable(),
  organization: z.string().max(100).optional().nullable(),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().int().positive().max(9999),
    notes: z.string().max(500).optional(),
  })).min(1, "At least one item is required"),
  totalAmount: z.number().int().min(0).optional().nullable(),
  orderSource: z.string().max(50).optional().nullable(),
  orderNumber: z.string().max(50).optional().nullable(),
  pickupTime: z.string().optional().nullable(),
  deliveryTime: z.string().optional().nullable(),
  readyTime: z.string().optional().nullable(),
  deliveryAddress: z.string().max(300).optional().nullable(),
  deliveryMode: z.enum(["pickup", "delivery"]).default("pickup"),
  notes: z.string().max(2000).optional().nullable(),
  utensilsRequested: z.boolean().optional().default(false),
  numberOfGuests: z.number().int().positive().max(9999).optional().nullable(),
  assignedStoreId: z.number().int().positive().optional().nullable(),
  assignedGmId: z.number().int().positive().optional().nullable(),
  assignedDriver: z.string().max(50).optional().nullable(),
  pdfUrl: z.string().max(500).optional().nullable(),
  labelsUrl: z.string().max(500).optional().nullable(),
  status: z.string().max(30).optional(),
  prepStatus: z.string().max(30).optional(),
  menuTbd: z.boolean().optional(),
});

export const UpdateOrderSchema = CreateOrderSchema.partial();

export const CreateUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  name: z.string().min(1, "Name is required").max(100),
  role: z.enum(["admin", "gm"]).default("gm"),
  storeId: z.number().int().positive().optional().nullable(),
});

export const CreateStoreSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  address: z.string().max(200).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});
