const PDFDocument = require("pdfkit");
const axios = require("axios");
const QRCode = require("qrcode");

/**
 * Generates a PDF invoice for an order.
 * @param {Object} order - The order object from MongoDB.
 * @param {Stream} stream - Output stream.
 * @param {Object} settings - Store settings (logo, phone, etc.)
 */
const generateInvoice = async (order, stream, settings = {}) => {
  const doc = new PDFDocument({ margin: 0, size: 'A4' });

  // Pipe to provided stream
  doc.pipe(stream);

  const store = settings.store_info || {
    name: "GENESIS FURNITURE",
    phone: "+91 98765 43210",
    email: "hello@genesisfurniture.com",
    website: "www.genesisfurniture.com",
    logo: ""
  };

  // --- Header ---
  doc.rect(0, 0, 595, 80).fill("#1A3324");
  
  let headerTextX = 40;
  if (store.logo) {
    try {
      const response = await axios.get(store.logo, { responseType: 'arraybuffer' });
      doc.image(response.data, 40, 15, { height: 50 });
      headerTextX = 110;
    } catch (e) {
      console.error("Invoice Logo Load Failed:", e.message);
    }
  }

  doc.fillColor("#FFFFFF").fontSize(20).text(store.name || "GENESIS FURNITURE", headerTextX, 25, { characterSpacing: 2 });
  doc.fontSize(8).text("PREMIUM INTERIORS & DECOR", headerTextX, 50, { characterSpacing: 1 });
  
  doc.fillColor("#FFFFFF").fontSize(9).text(`Phone: ${store.phone || "+91 98765 43210"}`, 350, 30, { width: 200, align: "right" });
  doc.text(`Email: ${store.email || "hello@genesisfurniture.com"}`, 350, 45, { width: 200, align: "right" });
  doc.text(store.website || "www.genesisfurniture.com", 350, 60, { width: 200, align: "right" });
  
  // --- Invoice Info ---
  doc.fillColor("#111827").fontSize(16).text("INVOICE", 40, 100);
  doc.fontSize(9).fillColor("#6B7280").text(`Invoice No: ${order._id.toString().toUpperCase()}`, 40, 120);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 40, 133);
  
  // --- Bill To ---
  doc.fillColor("#111827").fontSize(11).text("BILL TO:", 40, 160);
  doc.fontSize(12).text(order.customerName, 40, 175);
  doc.fontSize(9).fillColor("#4B5563").text(order.phone, 40, 192);
  doc.text(order.address || "No address provided", 40, 205, { width: 250 });

  // --- Table Header ---
  const tableTop = 240;
  doc.rect(40, tableTop, 515, 20).fill("#1A3324");
  doc.fillColor("#FFFFFF").fontSize(9).text("Item", 50, tableTop + 6);
  doc.text("Color", 240, tableTop + 6);
  doc.text("Qty", 340, tableTop + 6, { width: 40, align: "center" });
  doc.text("Price", 390, tableTop + 6, { width: 70, align: "right" });
  doc.text("Total", 470, tableTop + 6, { width: 75, align: "right" });

  // --- Table Content ---
  let position = tableTop + 25;
  order.items.forEach((item) => {
    doc.fillColor("#4B5563").fontSize(9).text(item.productName || "Product", 50, position);
    doc.text(item.colorName || "-", 240, position);
    doc.text(item.quantity.toString(), 340, position, { width: 40, align: "center" });
    doc.text(`Rs. ${item.unitPrice.toLocaleString()}`, 390, position, { width: 70, align: "right" });
    doc.text(`Rs. ${(item.unitPrice * item.quantity).toLocaleString()}`, 470, position, { width: 75, align: "right" });
    position += 18;
  });

  // --- Totals ---
  const subtotal = order.totalAmount;
  const discount = order.discount || 0;
  const grandTotal = subtotal - discount;
  const paid = order.advancePaid || 0;
  const balance = order.remainingBalance || 0;

  const totalPosition = Math.max(position + 20, 450);
  doc.fillColor("#111827").fontSize(9).text("Subtotal:", 340, totalPosition);
  doc.text(`Rs. ${subtotal.toLocaleString()}`, 470, totalPosition, { width: 75, align: "right" });

  doc.text("Discount:", 340, totalPosition + 18);
  doc.fillColor("#DC2626").text(`- Rs. ${discount.toLocaleString()}`, 470, totalPosition + 18, { width: 75, align: "right" });

  doc.fillColor("#111827").fontSize(11).text("Grand Total:", 340, totalPosition + 40);
  doc.text(`Rs. ${grandTotal.toLocaleString()}`, 470, totalPosition + 40, { width: 75, align: "right" });

  doc.fillColor("#059669").fontSize(9).text("Amount Paid:", 340, totalPosition + 62);
  doc.text(`Rs. ${paid.toLocaleString()}`, 470, totalPosition + 62, { width: 75, align: "right" });

  doc.fillColor("#DC2626").text("Balance Due:", 340, totalPosition + 80);
  doc.text(`Rs. ${balance.toLocaleString()}`, 470, totalPosition + 80, { width: 75, align: "right" });

  // Add Order Status
  doc.fillColor("#111827").fontSize(9).text("Order Status:", 340, totalPosition + 105);
  const statusColors = {
    'Delivered': "#059669",
    'Cancelled': "#DC2626",
    'Confirmed': "#1A3324",
    'Pending': "#EAB308"
  };
  const statusColor = statusColors[order.orderStatus] || "#EAB308";
  doc.fillColor(statusColor).text(order.orderStatus?.toUpperCase() || "PENDING", 470, totalPosition + 105, { width: 75, align: "right" });

  // --- Footer ---
  const footerTop = 750;
  doc.moveTo(40, footerTop).lineTo(555, footerTop).stroke("#E5E7EB");
  
  if (settings.googleReviewUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(settings.googleReviewUrl);
      doc.image(qrDataUrl, 490, footerTop + 10, { width: 50 });
      doc.fontSize(7).fillColor("#6B7280").text("Scan to Review", 480, footerTop + 65, { width: 70, align: "center" });
    } catch (e) {
      console.error("QR Code Generation Failed:", e.message);
    }
  }

  doc.fontSize(9).fillColor("#1A3324").text(`Thank you for choosing ${store.name || "Genesis Furniture"}!`, 40, footerTop + 10, { align: "center", width: 440 });
  doc.fontSize(8).fillColor("#6B7280").text("PREMIUM INTERIORS • SECURE • RELIABLE", 40, footerTop + 24, { align: "center", width: 440 });

  doc.end();
};

module.exports = { generateInvoice };
