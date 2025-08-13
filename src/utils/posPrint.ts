// POS thermal printer utility for ESC/POS commands
export interface PrintItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PrintData {
  storeName: string;
  customerName?: string;
  customerPhone?: string;
  items: PrintItem[];
  subtotal: number;
  tax: number;
  taxPercentage: number;
  total: number;
  currency: string;
  paymentMethod: string;
}

export class POSPrinter {
  private static ESC = '\x1B';
  private static GS = '\x1D';
  private static LF = '\x0A';
  private static CR = '\x0D';

  // ESC/POS Commands
  private static INIT = this.ESC + '@'; // Initialize printer
  private static ALIGN_CENTER = this.ESC + 'a' + '\x01'; // Center alignment
  private static ALIGN_LEFT = this.ESC + 'a' + '\x00'; // Left alignment
  private static ALIGN_RIGHT = this.ESC + 'a' + '\x02'; // Right alignment
  private static BOLD_ON = this.ESC + 'E' + '\x01'; // Bold on
  private static BOLD_OFF = this.ESC + 'E' + '\x00'; // Bold off
  private static SIZE_NORMAL = this.GS + '!' + '\x00'; // Normal size
  private static SIZE_DOUBLE = this.GS + '!' + '\x11'; // Double size
  private static CUT_PAPER = this.GS + 'V' + '\x41' + '\x03'; // Cut paper
  private static LINE_FEED = this.LF;
  private static DRAWER_OPEN = this.ESC + 'p' + '\x00' + '\x19' + '\xFA'; // Open cash drawer

  public static formatReceipt(data: PrintData): string {
    let receipt = '';

    // Initialize printer
    receipt += this.INIT;

    // Store name (centered, bold, double size)
    receipt += this.ALIGN_CENTER;
    receipt += this.SIZE_DOUBLE;
    receipt += this.BOLD_ON;
    receipt += data.storeName + this.LINE_FEED;
    receipt += this.BOLD_OFF;
    receipt += this.SIZE_NORMAL;
    receipt += this.LINE_FEED;

    // Separator line
    receipt += this.ALIGN_LEFT;
    receipt += '-'.repeat(48) + this.LINE_FEED;

    // Customer info
    if (data.customerName) {
      receipt += `Customer: ${data.customerName}` + this.LINE_FEED;
    }
    if (data.customerPhone) {
      receipt += `Phone: ${data.customerPhone}` + this.LINE_FEED;
    }
    receipt += `Date: ${new Date().toLocaleString()}` + this.LINE_FEED;
    receipt += `Payment: ${data.paymentMethod}` + this.LINE_FEED;
    receipt += '-'.repeat(48) + this.LINE_FEED;

    // Items header
    receipt += this.padLine('Item', 'Qty', 'Price', 'Total') + this.LINE_FEED;
    receipt += '-'.repeat(48) + this.LINE_FEED;

    // Items
    data.items.forEach(item => {
      const name = item.name.substring(0, 20); // Truncate long names
      const qty = item.quantity.toString();
      const price = `${data.currency}${item.price.toFixed(2)}`;
      const total = `${data.currency}${item.total.toFixed(2)}`;
      
      receipt += this.padLine(name, qty, price, total) + this.LINE_FEED;
    });

    // Separator
    receipt += '-'.repeat(48) + this.LINE_FEED;

    // Totals
    receipt += this.ALIGN_RIGHT;
    receipt += `Subtotal: ${data.currency}${data.subtotal.toFixed(2)}` + this.LINE_FEED;
    
    if (data.taxPercentage > 0) {
      receipt += `Tax (${data.taxPercentage}%): ${data.currency}${data.tax.toFixed(2)}` + this.LINE_FEED;
    }
    
    receipt += this.BOLD_ON;
    receipt += `TOTAL: ${data.currency}${data.total.toFixed(2)}` + this.LINE_FEED;
    receipt += this.BOLD_OFF;

    // Footer
    receipt += this.ALIGN_CENTER;
    receipt += this.LINE_FEED;
    receipt += 'Thank you for your business!' + this.LINE_FEED;
    receipt += this.LINE_FEED;
    receipt += this.LINE_FEED;

    // Cut paper
    receipt += this.CUT_PAPER;

    return receipt;
  }

  private static padLine(col1: string, col2: string, col3: string, col4: string): string {
    const maxWidth = 48;
    const col1Width = 16;
    const col2Width = 4;
    const col3Width = 10;
    const col4Width = 10;

    return (
      col1.padEnd(col1Width).substring(0, col1Width) +
      col2.padStart(col2Width).substring(0, col2Width) +
      col3.padStart(col3Width).substring(0, col3Width) +
      col4.padStart(col4Width).substring(0, col4Width)
    );
  }

  public static async print(data: PrintData): Promise<void> {
    try {
      // Try to use Web Serial API for direct printer communication
      if ('serial' in navigator) {
        await this.printViaSerial(data);
      } else {
        // Fallback to raw text printing with specific formatting
        await this.printViaRawText(data);
      }
    } catch (error) {
      console.error('Print error:', error);
      // Final fallback to browser print
      this.printViaBrowser(data);
    }
  }

  private static async printViaSerial(data: PrintData): Promise<void> {
    try {
      // Request serial port access
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });

      const writer = port.writable.getWriter();
      const receiptData = this.formatReceipt(data);
      
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(receiptData));
      
      writer.releaseLock();
      await port.close();
    } catch (error) {
      throw new Error('Serial printing failed: ' + error);
    }
  }

  private static async printViaRawText(data: PrintData): Promise<void> {
    // Create a formatted text receipt for raw printing
    const receiptText = this.formatTextReceipt(data);
    
    // Try to print using a hidden textarea (some POS systems intercept this)
    const textarea = document.createElement('textarea');
    textarea.value = receiptText;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    
    textarea.select();
    document.execCommand('copy');
    
    // Simulate Ctrl+P for direct printer access on some POS systems
    const printEvent = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true
    });
    document.dispatchEvent(printEvent);
    
    document.body.removeChild(textarea);
  }

  private static formatTextReceipt(data: PrintData): string {
    let receipt = '';
    
    // Store name
    receipt += data.storeName.center(48) + '\n';
    receipt += '='.repeat(48) + '\n';
    
    // Customer info
    if (data.customerName) receipt += `Customer: ${data.customerName}\n`;
    if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
    receipt += `Date: ${new Date().toLocaleString()}\n`;
    receipt += `Payment: ${data.paymentMethod}\n`;
    receipt += '-'.repeat(48) + '\n';
    
    // Items
    data.items.forEach(item => {
      const line = `${item.name.substring(0, 20).padEnd(20)} ${item.quantity.toString().padStart(3)} ${data.currency}${item.price.toFixed(2).padStart(8)} ${data.currency}${item.total.toFixed(2).padStart(8)}`;
      receipt += line + '\n';
    });
    
    receipt += '-'.repeat(48) + '\n';
    receipt += `Subtotal: ${data.currency}${data.subtotal.toFixed(2)}`.padStart(48) + '\n';
    if (data.taxPercentage > 0) {
      receipt += `Tax (${data.taxPercentage}%): ${data.currency}${data.tax.toFixed(2)}`.padStart(48) + '\n';
    }
    receipt += `TOTAL: ${data.currency}${data.total.toFixed(2)}`.padStart(48) + '\n';
    receipt += '\n';
    receipt += 'Thank you for your business!'.center(48) + '\n';
    
    return receipt;
  }

  private static printViaBrowser(data: PrintData): void {
    // Enhanced browser printing with better thermal printer CSS
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt</title>
          <style>
            @media print {
              @page { 
                size: 80mm auto; 
                margin: 0; 
              }
              body { 
                width: 80mm; 
                margin: 0; 
                padding: 5mm;
                font-family: 'Courier New', monospace;
                font-size: 10pt;
                line-height: 1.2;
              }
            }
            body {
              width: 80mm;
              margin: 0 auto;
              padding: 5mm;
              font-family: 'Courier New', monospace;
              font-size: 10pt;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .large { font-size: 14pt; }
            .separator { border-top: 1px dashed #000; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 1px 2px; }
            .item-name { width: 50%; }
            .item-qty { width: 15%; text-align: center; }
            .item-price { width: 17.5%; text-align: right; }
            .item-total { width: 17.5%; text-align: right; }
          </style>
        </head>
        <body>
          <div class="center bold large">${data.storeName}</div>
          <div class="separator"></div>
          ${data.customerName ? `<div>Customer: ${data.customerName}</div>` : ''}
          ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ''}
          <div>Date: ${new Date().toLocaleString()}</div>
          <div>Payment: ${data.paymentMethod}</div>
          <div class="separator"></div>
          
          <table>
            <thead>
              <tr>
                <td class="item-name bold">Item</td>
                <td class="item-qty bold">Qty</td>
                <td class="item-price bold">Price</td>
                <td class="item-total bold">Total</td>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(item => `
                <tr>
                  <td class="item-name">${item.name}</td>
                  <td class="item-qty">${item.quantity}</td>
                  <td class="item-price">${data.currency}${item.price.toFixed(2)}</td>
                  <td class="item-total">${data.currency}${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="separator"></div>
          <div class="right">Subtotal: ${data.currency}${data.subtotal.toFixed(2)}</div>
          ${data.taxPercentage > 0 ? `<div class="right">Tax (${data.taxPercentage}%): ${data.currency}${data.tax.toFixed(2)}</div>` : ''}
          <div class="right bold">TOTAL: ${data.currency}${data.total.toFixed(2)}</div>
          
          <div class="separator"></div>
          <div class="center">Thank you for your business!</div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    }
  }
}

// String extension for centering text
declare global {
  interface String {
    center(width: number): string;
  }
}

String.prototype.center = function(width: number): string {
  const padding = Math.max(0, width - this.length);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + this + ' '.repeat(rightPad);
};