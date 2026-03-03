import { getSheetsClient, isGoogleConfigured } from './google-auth';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

interface OrderData {
  orderNumber: string;
  customerName: string;
  organization?: string | null;
  pickupTime?: Date | null;
  deliveryTime?: Date | null;
  deliveryMode?: string | null;
  deliveryAddress?: string | null;
  totalAmount?: number | null;
  storeName?: string;
  status?: string | null;
  items?: { name: string; quantity: number }[];
  notes?: string | null;
  createdAt?: Date | null;
}

export async function appendOrderToSheet(order: OrderData): Promise<boolean> {
  if (!isGoogleConfigured()) {
    console.log('Google Sheets: Service account not configured, skipping sheet append');
    return false;
  }

  if (!SPREADSHEET_ID) {
    console.error('Google Sheets: GOOGLE_SHEETS_SPREADSHEET_ID env var is required');
    return false;
  }

  console.log('Google Sheets: Attempting to append order:', order.orderNumber);

  try {
    const sheets = getSheetsClient();

    if (!sheets) {
      console.log('Google Sheets: Client not available, skipping sheet append');
      return false;
    }

    const time = order.deliveryMode === 'delivery'
      ? order.deliveryTime
      : order.pickupTime;

    const timeStr = time ? new Date(time).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) : '';

    const amountStr = order.totalAmount
      ? `$${(order.totalAmount / 100).toFixed(2)}`
      : '';

    const itemsStr = order.items
      ? order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
      : '';

    const orderDateStr = time ? new Date(time).toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    const rowData = [
      order.orderNumber,
      orderDateStr,
      order.customerName,
      order.organization || '',
      order.deliveryMode === 'delivery' ? 'Delivery' : 'Pickup',
      timeStr,
      order.deliveryAddress || '',
      order.storeName || '',
      itemsStr,
      amountStr,
      order.status || 'new',
      order.notes || ''
    ];

    console.log('Google Sheets: Appending row to spreadsheet:', SPREADSHEET_ID);

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:L',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });

    console.log('Google Sheets: Order appended successfully:', order.orderNumber, 'Updates:', result.data.updates?.updatedCells);
    return true;
  } catch (error: any) {
    console.error('Google Sheets: Failed to append order:', order.orderNumber);
    console.error('Google Sheets: Error message:', error.message);
    if (error.response?.data) {
      console.error('Google Sheets: API error details:', JSON.stringify(error.response.data));
    }
    return false;
  }
}
