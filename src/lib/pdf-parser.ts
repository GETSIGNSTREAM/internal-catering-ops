import { extractText } from "unpdf";

function sanitizeText(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/\u0000/g, '').trim();
}

function sanitizeParsedData(data: ParsedOrderData): ParsedOrderData {
  return {
    ...data,
    customerName: sanitizeText(data.customerName) || '',
    customerEmail: sanitizeText(data.customerEmail),
    customerPhone: sanitizeText(data.customerPhone),
    organization: sanitizeText(data.organization),
    deliveryAddress: sanitizeText(data.deliveryAddress),
    notes: sanitizeText(data.notes),
    orderNumber: sanitizeText(data.orderNumber),
    orderSource: sanitizeText(data.orderSource),
    items: data.items.map(item => ({
      ...item,
      name: sanitizeText(item.name) || '',
      notes: sanitizeText(item.notes)
    }))
  };
}

export interface ParsedOrderData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  organization?: string;
  guestCount?: number;
  pickupTime?: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  deliveryMode: "pickup" | "delivery";
  items: Array<{ name: string; quantity: number; notes?: string }>;
  notes?: string;
  totalAmount?: number;
  orderNumber?: string;
  orderSource?: string;
  utensilsRequested?: boolean;
  /** Store ID detected from PDF header address (e.g., Foodja restaurant copy) */
  assignedStoreId?: number;
}

// Wildbird store addresses — used to auto-detect which store a PDF order belongs to.
// Matches street number from the restaurant header in PDFs (e.g., Foodja "Restaurant Copy").
const STORE_ADDRESS_MAP: Array<{ storeId: number; streetNumber: string; keywords: string[] }> = [
  { storeId: 4,  streetNumber: "10601", keywords: ["washington"] },
  { storeId: 5,  streetNumber: "318",   keywords: ["la brea"] },
  { storeId: 7,  streetNumber: "6374",  keywords: ["sunset"] },
  { storeId: 8,  streetNumber: "816",   keywords: ["8th"] },
  { storeId: 9,  streetNumber: "2333",  keywords: ["utah"] },
  { storeId: 10, streetNumber: "10917", keywords: ["lindbrook"] },
];

/**
 * Detect Wildbird store from PDF text by matching the restaurant address header.
 * Foodja PDFs have the store address near the top (e.g., "6374 Sunset Boulevard").
 */
function detectStoreFromAddress(text: string): number | undefined {
  // Only look at the first ~500 chars (header area) to avoid false matches
  const header = text.substring(0, 500).toLowerCase();
  for (const store of STORE_ADDRESS_MAP) {
    if (header.includes(store.streetNumber)) {
      return store.storeId;
    }
  }
  // Fallback: check keywords in header
  for (const store of STORE_ADDRESS_MAP) {
    if (store.keywords.some((kw) => header.includes(kw))) {
      return store.storeId;
    }
  }
  return undefined;
}

type PdfFormat = "bruni" | "foodja" | "ezcater" | "catercow" | "sharebite" | "zerocater" | "unknown";

function detectFormat(text: string): { format: PdfFormat; orderSource: string } {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("foodja") || lowerText.includes("foodja.com")) {
    return { format: "foodja", orderSource: "foodja" };
  }
  if (lowerText.includes("ezcater") || lowerText.includes("ez cater") || lowerText.includes("ezc-")) {
    return { format: "ezcater", orderSource: "ezcater" };
  }
  if (lowerText.includes("catercow")) {
    return { format: "catercow", orderSource: "catercow" };
  }
  if (lowerText.includes("sharebite")) {
    return { format: "sharebite", orderSource: "sharebite" };
  }
  if (lowerText.includes("zerocater") || lowerText.includes("zero cater") || lowerText.includes("zc order")) {
    return { format: "zerocater", orderSource: "zerocater" };
  }
  if (lowerText.includes("wildbird") || lowerText.includes("eatwildbird") || lowerText.includes("wild bird")) {
    return { format: "bruni", orderSource: "eatwildbird.com" };
  }
  if (text.includes("Catering BEO") || text.includes("jonathanbruni") || text.includes("BEO")) {
    return { format: "bruni", orderSource: "eatwildbird.com" };
  }
  return { format: "unknown", orderSource: "" };
}

function parseDate(text: string): string | undefined {
  const dateTimePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/gi,
    /(\d{1,2})-(\d{1,2})-(\d{2,4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/gi,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/gi,
    /(\w+day),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)/gi,
  ];

  for (const pattern of dateTimePatterns) {
    const match = pattern.exec(text);
    if (match) {
      try {
        const fullMatch = match[0];
        const parsed = new Date(fullMatch.replace(/\s+at\s+/i, ' '));
        if (!isNaN(parsed.getTime())) {
          return toPSTISOString(parsed);
        }
      } catch {}
    }
  }

  const dateOnlyPatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
  ];

  let dateStr = "";
  let timeStr = "";

  for (const pattern of dateOnlyPatterns) {
    const match = text.match(pattern);
    if (match) {
      dateStr = match[0];
      break;
    }
  }

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      timeStr = match[0];
      break;
    }
  }

  if (dateStr) {
    try {
      const combined = timeStr ? `${dateStr} ${timeStr}` : dateStr;
      const parsed = new Date(combined);
      if (!isNaN(parsed.getTime())) {
        return toPSTISOString(parsed);
      }
    } catch {}
  }

  return undefined;
}

function toPSTISOString(date: Date): string {
  const pstString = date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const pstDate = new Date(pstString);
  const offsetMs = date.getTime() - pstDate.getTime();
  const corrected = new Date(date.getTime() + offsetMs);
  return corrected.toISOString();
}

function extractCommonFields(text: string): Partial<ParsedOrderData> {
  const result: Partial<ParsedOrderData> = {};

  const emailPatterns = [
    /(?:email|e-mail|contact)[:\s]*([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
    /([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
  ];
  for (const pattern of emailPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.customerEmail = match[1] || match[0];
      break;
    }
  }

  const phonePatterns = [
    /(?:phone|tel|cell|mobile)[:\s]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i,
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
  ];
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.customerPhone = match[0].replace(/^(?:phone|tel|cell|mobile)[:\s]*/i, '').trim();
      break;
    }
  }

  const orderNumPatterns = [
    /Order\s*(?:#|No\.?|Number)[:\s]*([A-Z0-9-]+)/i,
    /Confirmation\s*(?:#|No\.?|Number)?[:\s]*([A-Z0-9-]+)/i,
    /(?:EZC|ZC|CC|SB|FJ)-?(\d+)/i,
    /#\s*([A-Z0-9-]{4,})/i,
  ];
  for (const pattern of orderNumPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.orderNumber = match[1] || match[0];
      break;
    }
  }

  const totalPatterns = [
    /(?:Grand\s*)?Total[:\s]*\$\s*([\d,]+\.?\d*)/i,
    /Order\s*Total[:\s]*\$\s*([\d,]+\.?\d*)/i,
    /Amount\s*(?:Due|Owed)[:\s]*\$\s*([\d,]+\.?\d*)/i,
    /Balance\s*(?:Due)?[:\s]*\$\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})\s*(?:Total|Due)/i,
  ];
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, "");
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        result.totalAmount = Math.round(amount * 100);
        break;
      }
    }
  }

  const guestPatterns = [
    /(?:Guest|Head)\s*(?:count|#)?[:\s]*(\d+)/i,
    /(?:Guests?|People|Persons?|Heads?)[:\s]*(\d+)/i,
    /\b(\d+)\s*(?:guests?|people|persons?|heads?)\b/i,
    /Serves?\s*(?:up to\s*)?(\d+)\b/i,
    /(?:Party\s*(?:of|size))[:\s]*(\d+)\b/i,
  ];
  for (const pattern of guestPatterns) {
    const match = text.match(pattern);
    if (match) {
      const matchIndex = match.index || 0;
      const precedingText = text.substring(Math.max(0, matchIndex - 15), matchIndex).toLowerCase();
      if (precedingText.match(/\b(hour|hr|day|week|month|year|min|sec|time)\b/)) continue;
      const count = parseInt(match[1]);
      if (count > 0 && count < 500) {
        result.guestCount = count;
        break;
      }
    }
  }

  const utensilPatterns = [
    /Utensils?\s*[:\s]*(Yes|No|Included|Requested|Required|Needed)/i,
    /(Include|Need|Request)\s*utensils?/i,
    /utensils?\s*(included|requested|needed)/i,
  ];
  for (const pattern of utensilPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = (match[1] || match[0]).toLowerCase();
      result.utensilsRequested = !val.includes("no");
      break;
    }
  }

  const addressPatterns = [
    /(?:Delivery|Deliver\s*to|Ship\s*to|Location)\s*(?:Address)?[:\s]*([^\n]+(?:,\s*[^\n]+)?)/i,
    /(?:Address)[:\s]*(\d+[^@\n]+(?:,\s*[^\n]+)?)/i,
    /(\d+\s+\w+(?:\s+\w+)*\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Ln|Lane|Ct|Court|Pl|Place)[.,]?\s*(?:#\s*\w+)?[,\s]*\w+[,\s]+[A-Z]{2}\s*\d{5})/i,
  ];
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const addr = match[1].trim().replace(/\n/g, ", ").replace(/\s+/g, " ");
      if (addr.length > 10 && addr.length < 200) {
        result.deliveryAddress = addr;
        result.deliveryMode = "delivery";
        break;
      }
    }
  }

  const orgPatterns = [
    /(?:Company|Organization|Business|Firm|Corp(?:oration)?)[:\s]*([^\n]{3,50})/i,
    /(?:Ordered?\s*(?:by|for))[:\s]*([^\n]{3,50})/i,
    /(?:Client|Account)[:\s]*([^\n]{3,50})/i,
  ];
  for (const pattern of orgPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const org = match[1].trim();
      if (org.length > 2 && !org.match(/^\d/) && !org.includes("@")) {
        result.organization = org;
        break;
      }
    }
  }

  const customerNamePatterns = [
    /(?:Customer|Client|Contact)\s*(?:Name)?[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:Ordered?\s*by|Placed\s*by|Name)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:Bill\s*to|Ship\s*to)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];
  for (const pattern of customerNamePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 50 && !name.includes("@")) {
        result.customerName = name;
        break;
      }
    }
  }

  const pickupDeliveryPatterns = [
    /(?:Pick-?up|Pickup)\s*(?:Date|Time)?[:\s]*/i,
    /(?:Delivery|Deliver)\s*(?:Date|Time)?[:\s]*/i,
    /(?:Ready|Due)\s*(?:by|at|Date|Time)?[:\s]*/i,
    /(?:Event|Order)\s*(?:Date|Time)?[:\s]*/i,
  ];

  for (const pattern of pickupDeliveryPatterns) {
    const match = text.match(pattern);
    if (match) {
      const startIdx = match.index! + match[0].length;
      const relevantText = text.substring(startIdx, startIdx + 100);
      const dateTime = parseDate(relevantText);
      if (dateTime) {
        if (pattern.source.toLowerCase().includes("deliver")) {
          result.deliveryTime = dateTime;
          result.deliveryMode = "delivery";
        } else {
          result.pickupTime = dateTime;
        }
        break;
      }
    }
  }

  return result;
}

function extractItems(text: string): Array<{ name: string; quantity: number; notes?: string }> {
  const items: Array<{ name: string; quantity: number; notes?: string }> = [];
  const itemPatterns = [
    /(\d+)\s*[xX×]\s*(.+?)(?:\s+\$[\d,.]+|$)/gm,
    /(?:^|\n)\s*(\d+)\s+([A-Z][^$\n]{3,50})(?:\s+\$[\d,.]+)?/gm,
    /\*\*(\d+)\*\*\s*(.+?)(?:\s+\$[\d,.]+|\s+Included|$)/gi,
    /Qty[:\s]*(\d+)\s+(.+?)(?:\s+\$[\d,.]+|$)/gm,
    /(\d+)\s+((?:Small|Medium|Large)\s*(?:Feast|Platter|Tray|Box))/gi,
    /(\d+)\s+([A-Za-z\s]+(?:Feast|Platter|Tray|Box|Meal|Combo|Package|Sampler))/gi,
  ];
  const seenItems = new Set<string>();
  for (const pattern of itemPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const qty = parseInt(match[1]);
      let name = match[2].trim().replace(/\s+/g, " ");
      name = name.replace(/^[-•·]\s*/, "");
      if (name.length > 2 && name.length < 100 && qty > 0 && qty < 1000) {
        const key = name.toLowerCase();
        if (!seenItems.has(key)) {
          seenItems.add(key);
          items.push({ name, quantity: qty });
        }
      }
    }
  }
  const feastPatterns = [
    /(SMALL|MEDIUM|LARGE)\s*FEAST/gi,
    /(Small|Medium|Large)\s*(?:Chicken\s*)?Feast/gi,
    /Feast\s*-?\s*(Small|Medium|Large)/gi,
  ];
  if (items.length === 0) {
    for (const pattern of feastPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const size = match[1];
        const key = `${size.toLowerCase()} feast`;
        if (!seenItems.has(key)) {
          seenItems.add(key);
          items.push({ name: `${size.toUpperCase()} FEAST`, quantity: 1 });
        }
      }
    }
  }
  return items;
}

function parseBruniFormat(text: string): ParsedOrderData {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const common = extractCommonFields(text);
  const items = extractItems(text);

  let customerName = common.customerName || "";
  let pickupTimeStr = common.pickupTime || "";

  if (!customerName) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes("customer") && i < lines.length - 1) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nameLine = lines[j];
          if (nameLine && !nameLine.includes("@") && !nameLine.match(/^\(?\d/) &&
              nameLine.length > 2 && nameLine.length < 50 &&
              nameLine.match(/^[A-Z]/)) {
            customerName = nameLine.split(/\s{2,}/)[0];
            break;
          }
        }
        break;
      }
    }
  }

  if (!pickupTimeStr) {
    const dateMatch = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(\w+\s+\d{1,2},?\s+\d{4})/i);
    const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

    if (dateMatch && timeMatch) {
      try {
        const combinedStr = `${dateMatch[2]} ${timeMatch[1]}`;
        const parsedDate = new Date(combinedStr);
        if (!isNaN(parsedDate.getTime())) {
          pickupTimeStr = parsedDate.toISOString();
        }
      } catch {}
    }
  }

  const notesArr: string[] = [];
  const chickenMatch = text.match(/Chicken\s*(?:Selection|Choice)?[:\s]*([^\n]+)/i);
  if (chickenMatch) notesArr.push(`Chicken: ${chickenMatch[1].trim()}`);

  const sideMatches = text.match(/Side[:\s]*([^\n]+)/gi);
  if (sideMatches) {
    sideMatches.slice(0, 4).forEach(m => notesArr.push(m.replace(/Side[:\s]*/i, "Side: ")));
  }

  const salsaMatches = text.match(/Salsa[:\s]*([^\n]+)/gi);
  if (salsaMatches) {
    salsaMatches.slice(0, 2).forEach(m => notesArr.push(m));
  }

  return {
    customerName: customerName || "Unknown Customer",
    customerEmail: common.customerEmail,
    customerPhone: common.customerPhone,
    organization: common.organization,
    guestCount: common.guestCount,
    pickupTime: pickupTimeStr || undefined,
    deliveryMode: common.deliveryMode || "pickup",
    deliveryAddress: common.deliveryAddress,
    items: items.length > 0 ? items : [{ name: "Catering Order", quantity: 1 }],
    notes: notesArr.length > 0 ? notesArr.join("; ") : undefined,
    totalAmount: common.totalAmount,
    utensilsRequested: common.utensilsRequested
  };
}

function parseFoodjaFormat(text: string): ParsedOrderData {
  const common = extractCommonFields(text);
  const items = extractItems(text);

  let notes: string[] = [];
  const specialInstrMatch = text.match(/SPECIAL INSTRUCTIONS[:\s]*([\s\S]*?)(?:Qty|Total:|Order|$)/i);
  if (specialInstrMatch) {
    const instrText = specialInstrMatch[1].trim();
    const instrLines = instrText.split("\n").map(l => l.trim()).filter(Boolean);
    notes = instrLines.filter(l => !l.match(/^(Qty|Item|Price)/)).slice(0, 5);
  }

  const choiceMatches = text.match(/Choice of[^:]*:[^\n]+/gi);
  if (choiceMatches) {
    choiceMatches.slice(0, 6).forEach(c => notes.push(c.trim()));
  }

  return {
    customerName: common.customerName || (common.orderNumber ? `Order #${common.orderNumber}` : "Foodja Order"),
    customerEmail: common.customerEmail,
    customerPhone: common.customerPhone,
    organization: common.organization,
    orderNumber: common.orderNumber,
    guestCount: common.guestCount,
    pickupTime: common.pickupTime || undefined,
    deliveryTime: common.deliveryTime || undefined,
    deliveryMode: common.deliveryMode || "pickup",
    deliveryAddress: common.deliveryAddress,
    items: items.length > 0 ? items : [{ name: "Catering Order", quantity: 1 }],
    notes: notes.length > 0 ? notes.join("; ") : undefined,
    totalAmount: common.totalAmount,
    utensilsRequested: common.utensilsRequested || text.toLowerCase().includes("utensils")
  };
}

function parseEZCaterFormat(text: string): ParsedOrderData {
  const common = extractCommonFields(text);
  const items = extractItems(text);

  const notes: string[] = [];

  const setupMatch = text.match(/Setup\s*(?:Style|Type)?[:\s]*([^\n]+)/i);
  if (setupMatch) notes.push(`Setup: ${setupMatch[1].trim()}`);

  const instrMatch = text.match(/(?:Special\s*)?Instructions?[:\s]*([\s\S]*?)(?:Total|Payment|$)/i);
  if (instrMatch) {
    const instrLines = instrMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    instrLines.slice(0, 3).forEach(l => notes.push(l));
  }

  return {
    customerName: common.customerName || (common.orderNumber ? `EZCater #${common.orderNumber}` : "EZCater Order"),
    customerEmail: common.customerEmail,
    customerPhone: common.customerPhone,
    organization: common.organization,
    orderNumber: common.orderNumber,
    guestCount: common.guestCount,
    pickupTime: common.pickupTime,
    deliveryTime: common.deliveryTime,
    deliveryMode: common.deliveryMode || "delivery",
    deliveryAddress: common.deliveryAddress,
    items: items.length > 0 ? items : [{ name: "Catering Order", quantity: 1 }],
    notes: notes.length > 0 ? notes.join("; ") : undefined,
    totalAmount: common.totalAmount,
    utensilsRequested: common.utensilsRequested
  };
}

function parseGenericFormat(text: string): ParsedOrderData {
  const common = extractCommonFields(text);
  const items = extractItems(text);

  return {
    customerName: common.customerName || (common.orderNumber ? `Order #${common.orderNumber}` : "Unknown Customer"),
    customerEmail: common.customerEmail,
    customerPhone: common.customerPhone,
    organization: common.organization,
    guestCount: common.guestCount,
    deliveryMode: common.deliveryMode || "pickup",
    deliveryAddress: common.deliveryAddress,
    pickupTime: common.pickupTime,
    deliveryTime: common.deliveryTime,
    items: items.length > 0 ? items : [{ name: "Catering Order (PDF Import)", quantity: 1 }],
    totalAmount: common.totalAmount,
    orderNumber: common.orderNumber,
    utensilsRequested: common.utensilsRequested
  };
}

export async function parsePdf(buffer: Buffer): Promise<ParsedOrderData> {
  const { text: extractedText } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const text = extractedText;
  const { format, orderSource } = detectFormat(text);
  let parsed: ParsedOrderData;
  switch (format) {
    case "bruni": parsed = parseBruniFormat(text); break;
    case "foodja": parsed = parseFoodjaFormat(text); break;
    case "ezcater": parsed = parseEZCaterFormat(text); break;
    case "catercow":
    case "sharebite":
    case "zerocater": parsed = parseGenericFormat(text); break;
    default: parsed = parseGenericFormat(text);
  }
  const assignedStoreId = detectStoreFromAddress(text);
  const finalData = { ...parsed, orderSource: orderSource || parsed.orderSource, assignedStoreId };
  return sanitizeParsedData(finalData);
}
