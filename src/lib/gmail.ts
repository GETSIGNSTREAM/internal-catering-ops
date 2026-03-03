import { getGmailClient, isGoogleConfigured } from './google-auth';

const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'hello@eatwildbird.com';

function createEmail(to: string, subject: string, htmlBody: string): string {
  const emailLines = [
    `To: ${to}`,
    `From: ${SENDER_EMAIL}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody
  ];

  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function formatCurrency(cents: number | null | undefined): string {
  if (!cents) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'TBD';
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

interface OrderConfirmationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  organization?: string;
  items: { name: string; quantity: number; notes?: string }[];
  totalAmount: number | null;
  pickupTime: Date | null;
  deliveryTime: Date | null;
  deliveryMode: string | null;
  deliveryAddress: string | null;
  storeName?: string;
  notes?: string | null;
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<void> {
  if (!data.customerEmail) {
    console.log('No customer email provided, skipping confirmation email');
    return;
  }

  if (!isGoogleConfigured()) {
    console.log('Gmail: Google service account not configured, skipping order confirmation email');
    return;
  }

  try {
    const gmail = getGmailClient(SENDER_EMAIL);

    if (!gmail) {
      console.log('Gmail not configured, skipping order confirmation email');
      return;
    }

    const isDelivery = data.deliveryMode === 'delivery';
    const scheduledTime = isDelivery ? data.deliveryTime : data.pickupTime;

    const itemsHtml = data.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        ${item.notes ? `<td style="padding: 10px; border-bottom: 1px solid #eee; font-style: italic; color: #666;">${item.notes}</td>` : '<td style="padding: 10px; border-bottom: 1px solid #eee;">-</td>'}
      </tr>
    `).join('');

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .order-details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .items-table th { background: #1a1a2e; color: white; padding: 10px; text-align: left; }
    .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 15px; }
    .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WILDBIRD Catering</h1>
    <h2>Order Confirmation</h2>
  </div>

  <div class="content">
    <p>Dear ${data.customerName},</p>

    <p>Thank you for your catering order! We're excited to serve you.</p>

    <div class="order-details">
      <h3>Order Details</h3>
      <p><strong>Order Number:</strong> ${data.orderNumber}</p>
      ${data.organization ? `<p><strong>Organization:</strong> ${data.organization}</p>` : ''}
      <p><strong>${isDelivery ? 'Delivery' : 'Pickup'} Time:</strong> ${formatDate(scheduledTime)}</p>
      ${isDelivery && data.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>` : ''}
      ${data.storeName ? `<p><strong>Store Location:</strong> ${data.storeName}</p>` : ''}
    </div>

    <h3>Order Items</h3>
    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="total">
      Total: ${formatCurrency(data.totalAmount)}
    </div>

    ${data.notes ? `<p><strong>Special Instructions:</strong> ${data.notes}</p>` : ''}

    <p>If you have any questions about your order, please don't hesitate to contact us.</p>

    <p>Best regards,<br>The WILDBIRD Catering Team</p>
  </div>

  <div class="footer">
    <p>This is an automated confirmation email. Please do not reply directly to this message.</p>
  </div>
</body>
</html>
    `;

    const subject = `Order Confirmation - ${data.orderNumber} - WILDBIRD Catering`;
    const encodedEmail = createEmail(data.customerEmail, subject, htmlBody);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log(`Order confirmation email sent to ${data.customerEmail} for order ${data.orderNumber}`);
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    throw error;
  }
}

interface StatusUpdateData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  oldStatus: string;
  newStatus: string;
  pickupTime: Date | null;
  deliveryTime: Date | null;
  deliveryMode: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  'new': 'New',
  'confirmed': 'Confirmed',
  'in-progress': 'In Progress',
  'ready': 'Ready',
  'completed': 'Completed',
  'cancelled': 'Cancelled'
};

export async function sendOrderStatusUpdateEmail(data: StatusUpdateData): Promise<void> {
  if (!data.customerEmail) {
    console.log('No customer email provided, skipping status update email');
    return;
  }

  if (!isGoogleConfigured()) {
    console.log('Gmail: Google service account not configured, skipping status update email');
    return;
  }

  try {
    const gmail = getGmailClient(SENDER_EMAIL);

    if (!gmail) {
      console.log('Gmail not configured, skipping status update email');
      return;
    }

    const isDelivery = data.deliveryMode === 'delivery';
    const scheduledTime = isDelivery ? data.deliveryTime : data.pickupTime;
    const statusLabel = STATUS_LABELS[data.newStatus] || data.newStatus;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-in-progress { background: #fff3cd; color: #856404; }
    .status-ready { background: #cce5ff; color: #004085; }
    .status-completed { background: #d4edda; color: #155724; }
    .status-cancelled { background: #f8d7da; color: #721c24; }
    .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WILDBIRD Catering</h1>
    <h2>Order Status Update</h2>
  </div>

  <div class="content">
    <p>Dear ${data.customerName},</p>

    <p>Your order <strong>${data.orderNumber}</strong> has been updated.</p>

    <p>New Status: <span class="status-badge status-${data.newStatus}">${statusLabel}</span></p>

    ${data.newStatus === 'ready' ? `<p><strong>Your order is ready for ${isDelivery ? 'delivery' : 'pickup'}!</strong></p>` : ''}
    ${data.newStatus === 'completed' ? `<p><strong>Thank you for choosing WILDBIRD Catering! We hope you enjoyed your order.</strong></p>` : ''}

    <p><strong>Scheduled ${isDelivery ? 'Delivery' : 'Pickup'}:</strong> ${formatDate(scheduledTime)}</p>

    <p>If you have any questions, please contact us.</p>

    <p>Best regards,<br>The WILDBIRD Catering Team</p>
  </div>

  <div class="footer">
    <p>This is an automated notification. Please do not reply directly to this message.</p>
  </div>
</body>
</html>
    `;

    const subject = `Order ${data.orderNumber} - Status Update: ${statusLabel}`;
    const encodedEmail = createEmail(data.customerEmail, subject, htmlBody);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    });

    console.log(`Status update email sent to ${data.customerEmail} for order ${data.orderNumber}`);
  } catch (error) {
    console.error('Failed to send status update email:', error);
    throw error;
  }
}
