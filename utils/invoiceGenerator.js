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
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  // Pipe to provided stream
  doc.pipe(stream);

  const store = settings.store_info || {
    name: "GENESIS FURNITURE",
    phone: "+91 98765 43210",
    email: "hello@genesisfurniture.com",
    website: "www.genesisfurniture.com",
    address: "Palayapalayam (RSF No 3/4, Puliankattu Thottam, 191/1, Perundurai Rd, opp. Renault Carshowroom, Indu Nagar, Erode, Tamil Nadu 638012",
    logo: ""
  };

  // --- Header ---
  doc.rect(0, 0, 595, 110).fill("#1A3324");
  
  let headerTextX = 40;
  if (store.logo) {
    try {
      const response = await axios.get(store.logo, { responseType: 'arraybuffer' });
      doc.image(response.data, 40, 20, { height: 60 });
      headerTextX = 120;
    } catch (e) {
      console.error("Invoice Logo Load Failed:", e.message);
    }
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24).text(store.name || "GENESIS FURNITURE", headerTextX, 30, { characterSpacing: 1 });
  doc.font("Helvetica").fontSize(8).text("PREMIUM INTERIORS & DECOR SOLUTIONS", headerTextX, 60, { characterSpacing: 1 });
  
  doc.fillColor("#FFFFFF").fontSize(9).text(store.address, 300, 30, { width: 255, align: "right", lineGap: 2 });
  doc.text(`Phone: ${store.phone}`, 300, 75, { width: 255, align: "right" });
  doc.text(store.website, 300, 88, { width: 255, align: "right" });
  
  // --- Invoice Info Header ---
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(20).text("INVOICE", 40, 130);
  
  // Draw a line
  doc.moveTo(40, 155).lineTo(555, 155).strokeColor("#E5E7EB").lineWidth(1).stroke();

  // --- Billing Info Grid ---
  // Left side: Customer Info
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(10).text("BILL TO", 40, 170);
  doc.fillColor("#111827").fontSize(12).text(order.customerName, 40, 185);
  doc.font("Helvetica").fontSize(10).fillColor("#4B5563").text(order.phone, 40, 202);
  doc.text(order.address || "No address provided", 40, 215, { width: 250 });

  // Right side: Order Info
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(10).text("INVOICE DETAILS", 350, 170);
  doc.fillColor("#111827").font("Helvetica").fontSize(10).text(`Invoice No:`, 350, 185);
  doc.font("Helvetica-Bold").text(order._id.toString().toUpperCase().slice(-8), 430, 185);
  
  doc.font("Helvetica").text(`Date:`, 350, 200);
  doc.font("Helvetica-Bold").text(new Date(order.createdAt).toLocaleDateString('en-IN'), 430, 200);
  
  doc.font("Helvetica").text(`Status:`, 350, 215);
  const statusColors = {
    'Delivered': "#059669",
    'Cancelled': "#DC2626",
    'Confirmed': "#1A3324",
    'Pending': "#EAB308"
  };
  const statusColor = statusColors[order.orderStatus] || "#EAB308";
  doc.fillColor(statusColor).font("Helvetica-Bold").text(order.orderStatus?.toUpperCase() || "PENDING", 430, 215);

  // --- Table Header ---
  const tableTop = 260;
  const col1 = 40;
  const col2 = 240;
  const col3 = 340;
  const col4 = 400;
  const col5 = 480;
  const tableWidth = 515;

  doc.rect(col1, tableTop, tableWidth, 25).fill("#1A3324");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10).text("Item Description", col1 + 10, tableTop + 8);
  doc.text("Color", col2, tableTop + 8);
  doc.text("Qty", col3, tableTop + 8, { width: 50, align: "center" });
  doc.text("Price", col4, tableTop + 8, { width: 70, align: "right" });
  doc.text("Total", col5, tableTop + 8, { width: 65, align: "right" });

  // --- Table Content ---
  let position = tableTop + 25;
  doc.font("Helvetica").fontSize(9);
  
  order.items.forEach((item, index) => {
    // Zebra striping
    if (index % 2 === 1) {
      doc.rect(col1, position, tableWidth, 25).fill("#F9FAFB");
    }
    
    // Bottom border for each row
    doc.moveTo(col1, position + 25).lineTo(col1 + tableWidth, position + 25).strokeColor("#F3F4F6").lineWidth(0.5).stroke();

    doc.fillColor("#1F2937").text(item.productName || "Product", col1 + 10, position + 8, { width: 180 });
    doc.text(item.colorName || "-", col2, position + 8);
    doc.text(item.quantity.toString(), col3, position + 8, { width: 50, align: "center" });
    doc.text(`₹${item.unitPrice.toLocaleString('en-IN')}`, col4, position + 8, { width: 70, align: "right" });
    doc.font("Helvetica-Bold").text(`₹${(item.unitPrice * item.quantity).toLocaleString('en-IN')}`, col5, position + 8, { width: 65, align: "right" });
    doc.font("Helvetica");
    
    position += 25;
  });

  // Table Outer Border
  doc.rect(col1, tableTop, tableWidth, position - tableTop).strokeColor("#E5E7EB").lineWidth(1).stroke();

  // --- Summary Section ---
  const summaryTop = position + 30;
  const summaryLeft = 350;
  const valueLeft = 470;

  const drawSummaryLine = (label, value, y, isBold = false, color = "#111827") => {
    doc.fillColor("#4B5563").font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(10).text(label, summaryLeft, y);
    doc.fillColor(color).font(isBold ? "Helvetica-Bold" : "Helvetica").text(value, valueLeft, y, { width: 85, align: "right" });
  };

  const subtotal = order.totalAmount;
  const discount = order.discount || 0;
  const grandTotal = subtotal - discount;
  const paid = order.advancePaid || 0;
  const balance = order.remainingBalance || 0;

  drawSummaryLine("Subtotal", `₹${subtotal.toLocaleString('en-IN')}`, summaryTop);
  drawSummaryLine("Discount", `- ₹${discount.toLocaleString('en-IN')}`, summaryTop + 20, false, "#DC2626");
  
  // Grand Total Box
  doc.rect(summaryLeft - 10, summaryTop + 40, 215, 30).fill("#F3F4F6");
  drawSummaryLine("Grand Total", `₹${grandTotal.toLocaleString('en-IN')}`, summaryTop + 50, true, "#1A3324");

  drawSummaryLine("Amount Paid", `₹${paid.toLocaleString('en-IN')}`, summaryTop + 85, false, "#059669");
  drawSummaryLine("Balance Due", `₹${balance.toLocaleString('en-IN')}`, summaryTop + 105, true, "#DC2626");

  // --- Thank You Message ---
  doc.font("Helvetica-Oblique").fontSize(10).fillColor("#6B7280")
    .text("Notes: Items once sold cannot be returned. Warranty as per manufacturer terms.", 40, summaryTop + 140);

  // --- Footer ---
  const footerTop = 730;
  doc.rect(0, footerTop, 595, 112).fill("#1A3324");
  
  if (settings.googleReviewUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(settings.googleReviewUrl, { margin: 1, color: { dark: '#1A3324', light: '#FFFFFF' } });
      doc.image(qrDataUrl, 40, footerTop + 20, { width: 60 });
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8).text("SCAN TO RATE US", 35, footerTop + 85, { width: 70, align: "center" });
    } catch (e) {
      console.error("QR Code Generation Failed:", e.message);
    }
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(14).text(`Thank you for your business!`, 120, footerTop + 30, { align: "center", width: 350 });
  doc.font("Helvetica").fontSize(8).fillColor("#BDBDBD").text("WE APPRECIATE YOUR TRUST IN GENESIS FURNITURE FOR YOUR HOME DECOR NEEDS.", 120, footerTop + 50, { align: "center", width: 350 });
  
  doc.moveTo(150, footerTop + 75).lineTo(440, footerTop + 75).strokeColor("rgba(255,255,255,0.2)").lineWidth(0.5).stroke();
  doc.text("PRODUCED BY GENESIS FURNITURE MANAGEMENT SYSTEM", 120, footerTop + 85, { align: "center", width: 350 });

  doc.end();
};

module.exports = { generateInvoice };
