interface SlackMessage {
  text: string;
  blocks?: any[];
}

interface OrderNotification {
  orderNumber: string;
  customerName: string;
  organization?: string;
  pickupTime?: Date | null;
  deliveryTime?: Date | null;
  deliveryMode?: string;
  totalAmount?: number | null;
  storeName?: string;
}

export async function sendSlackNotification(message: SlackMessage): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Slack webhook URL not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Slack notification failed:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return false;
  }
}

export async function notifyNewOrder(order: OrderNotification): Promise<boolean> {
  const time = order.deliveryMode === 'delivery'
    ? order.deliveryTime
    : order.pickupTime;

  const timeStr = time ? new Date(time).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }) : 'TBD';

  const amountStr = order.totalAmount
    ? `$${(order.totalAmount / 100).toFixed(2)}`
    : 'TBD';

  const message: SlackMessage = {
    text: `New Catering Order: ${order.orderNumber}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "New Catering Order",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Order:*\n${order.orderNumber}`
          },
          {
            type: "mrkdwn",
            text: `*Customer:*\n${order.customerName}${order.organization ? ` (${order.organization})` : ''}`
          },
          {
            type: "mrkdwn",
            text: `*${order.deliveryMode === 'delivery' ? 'Delivery' : 'Pickup'} Time:*\n${timeStr}`
          },
          {
            type: "mrkdwn",
            text: `*Total:*\n${amountStr}`
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: order.storeName ? `${order.storeName}` : "Store TBD"
          }
        ]
      }
    ]
  };

  return sendSlackNotification(message);
}

export async function notifyOrderStatusChange(
  orderNumber: string,
  customerName: string,
  oldStatus: string,
  newStatus: string
): Promise<boolean> {
  const statusEmoji: Record<string, string> = {
    'new': '',
    'prep': '',
    'ready': '',
    'delivered': '',
    'completed': ''
  };

  const message: SlackMessage = {
    text: `Order ${orderNumber} status changed to ${newStatus}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${statusEmoji[newStatus] || ''} *Order ${orderNumber}* for *${customerName}*\nStatus: _${oldStatus}_ -> *${newStatus}*`
        }
      }
    ]
  };

  return sendSlackNotification(message);
}
