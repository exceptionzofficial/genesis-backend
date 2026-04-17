const PDFDocument = require("pdfkit");
const axios = require("axios");
const QRCode = require("qrcode");

/**
 * Generates a single-page A4 PDF invoice for an order.
 * @param {Object} order - The order object from MongoDB.
 * @param {Stream} stream - Output stream.
 * @param {Object} settings - Store settings (logo, phone, etc.)
 */
const generateInvoice = async (order, stream, settings = {}) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' }); // A4: 595 x 842 pts

  // Pipe to provided stream
  doc.pipe(stream);

  const pageW = 595;
  const pageH = 842;
  const ml = 30; // margin left
  const mr = 30; // margin right
  const contentW = pageW - ml - mr; // 535

  const store = settings.store_info || {
    name: "GENESIS FURNITURE",
    phone: "+91 98765 43210",
    email: "hello@genesisfurniture.com",
    website: "www.genesisfurniture.com",
    address: "Palayapalayam (RSF No 3/4, Puliankattu Thottam, 191/1, Perundurai Rd, opp. Renault Carshowroom, Indu Nagar, Erode, Tamil Nadu 638012",
    logo: ""
  };

  // ===========================
  // HEADER BAR (compact: 80pt)
  // ===========================
  const headerH = 80;
  doc.rect(0, 0, pageW, headerH).fill("#1A3324");
  
  let headerTextX = ml;
  if (store.logo) {
    try {
      const response = await axios.get(store.logo, { responseType: 'arraybuffer' });
      doc.image(response.data, ml, 14, { height: 50 });
      headerTextX = ml + 70;
    } catch (e) {
      console.error("Invoice Logo Load Failed:", e.message);
    }
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(store.name || "GENESIS FURNITURE", headerTextX, 18, { characterSpacing: 0.5 });
  doc.font("Helvetica").fontSize(7).text("PREMIUM INTERIORS & DECOR SOLUTIONS", headerTextX, 40, { characterSpacing: 0.5 });

  // Address in header - right side
  doc.fillColor("#FFFFFF").fontSize(7).text(store.address, 300, 14, { width: pageW - 300 - mr, align: "right", lineGap: 1.5 });
  doc.text(`Phone: ${store.phone}`, 300, 56, { width: pageW - 300 - mr, align: "right" });
  doc.text(store.website || store.email || "", 300, 66, { width: pageW - 300 - mr, align: "right" });

  // ===========================
  // INVOICE TITLE + INFO
  // ===========================
  let y = headerH + 12;

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(16).text("INVOICE", ml, y);
  y += 20;
  doc.moveTo(ml, y).lineTo(pageW - mr, y).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
  y += 8;

  // --- Billing Info Grid (Left: Customer, Right: Invoice details) ---
  const infoY = y;

  // Left: BILL TO
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8).text("BILL TO", ml, infoY);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text(order.customerName, ml, infoY + 12);
  doc.font("Helvetica").fontSize(9).fillColor("#4B5563").text(order.phone, ml, infoY + 26);
  const addressText = order.address || "No address provided";
  doc.text(addressText, ml, infoY + 38, { width: 240, lineGap: 1 });

  // Right: INVOICE DETAILS
  const rightCol = 370;
  const valCol = 450;
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8).text("INVOICE DETAILS", rightCol, infoY);

  doc.fillColor("#111827").font("Helvetica").fontSize(9).text("Invoice No:", rightCol, infoY + 13);
  doc.font("Helvetica-Bold").text(order._id.toString().toUpperCase().slice(-8), valCol, infoY + 13);

  doc.font("Helvetica").text("Date:", rightCol, infoY + 26);
  doc.font("Helvetica-Bold").text(new Date(order.createdAt).toLocaleDateString('en-IN'), valCol, infoY + 26);

  if (order.deliveryDate) {
    doc.font("Helvetica").text("Delivery:", rightCol, infoY + 39);
    doc.font("Helvetica-Bold").text(new Date(order.deliveryDate).toLocaleDateString('en-IN'), valCol, infoY + 39);
  }

  doc.font("Helvetica").text("Status:", rightCol, infoY + 52);
  const statusColors = {
    'Delivered': "#059669", 'delivered': "#059669",
    'Cancelled': "#DC2626", 'cancelled': "#DC2626",
    'Confirmed': "#1A3324", 'confirmed': "#1A3324",
    'Pending': "#D97706", 'pending': "#D97706"
  };
  const statusColor = statusColors[order.orderStatus] || "#D97706";
  doc.fillColor(statusColor).font("Helvetica-Bold").text((order.orderStatus || "PENDING").toUpperCase(), valCol, infoY + 52);

  // ===========================
  // ITEMS TABLE
  // ===========================
  y = infoY + 72;

  const col1 = ml;        // # 
  const col2 = ml + 22;   // Item
  const col3 = 250;       // Color
  const col4 = 330;       // Qty
  const col5 = 390;       // Price
  const col6 = 480;       // Total
  const tableRight = pageW - mr;
  const tableWidth = tableRight - col1;

  // Table Header
  const thH = 20;
  doc.rect(col1, y, tableWidth, thH).fill("#1A3324");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
  doc.text("#", col1 + 5, y + 6);
  doc.text("Item Description", col2 + 5, y + 6);
  doc.text("Color", col3, y + 6, { width: 70 });
  doc.text("Qty", col4, y + 6, { width: 50, align: "center" });
  doc.text("Price", col5, y + 6, { width: 70, align: "right" });
  doc.text("Total", col6, y + 6, { width: tableRight - col6 - 5, align: "right" });

  y += thH;

  // Table Rows
  const rowH = 18;
  doc.font("Helvetica").fontSize(8);

  order.items.forEach((item, index) => {
    // Zebra
    if (index % 2 === 1) {
      doc.rect(col1, y, tableWidth, rowH).fill("#F9FAFB");
    }

    // Row bottom line
    doc.moveTo(col1, y + rowH).lineTo(tableRight, y + rowH).strokeColor("#F3F4F6").lineWidth(0.3).stroke();

    const rowTextY = y + 5;
    doc.fillColor("#6B7280").text(`${index + 1}`, col1 + 5, rowTextY);
    doc.fillColor("#1F2937").font("Helvetica-Bold").text(item.productName || "Product", col2 + 5, rowTextY, { width: col3 - col2 - 10 });
    doc.font("Helvetica").fillColor("#4B5563").text(item.colorName || "-", col3, rowTextY, { width: 70 });
    doc.fillColor("#1F2937").text(item.quantity.toString(), col4, rowTextY, { width: 50, align: "center" });
    doc.text(`₹${item.unitPrice.toLocaleString('en-IN')}`, col5, rowTextY, { width: 70, align: "right" });
    doc.font("Helvetica-Bold").fillColor("#111827").text(`₹${(item.unitPrice * item.quantity).toLocaleString('en-IN')}`, col6, rowTextY, { width: tableRight - col6 - 5, align: "right" });
    doc.font("Helvetica");

    y += rowH;
  });

  // Table Outer Border
  doc.rect(col1, infoY + 72, tableWidth, y - (infoY + 72)).strokeColor("#E5E7EB").lineWidth(0.5).stroke();

  // ===========================
  // SUMMARY SECTION
  // ===========================
  y += 12;

  const summaryLeft = 370;
  const summaryValLeft = 480;
  const summaryValW = tableRight - summaryValLeft;

  const drawLine = (label, value, yPos, isBold = false, color = "#111827") => {
    doc.fillColor("#4B5563").font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(label, summaryLeft, yPos);
    doc.fillColor(color).font(isBold ? "Helvetica-Bold" : "Helvetica").text(value, summaryValLeft, yPos, { width: summaryValW, align: "right" });
  };

  const subtotal = order.totalAmount;
  const discount = order.discount || 0;
  const gstPercentage = order.gstPercentage || 0;
  const gstAmount = order.gstAmount || 0;
  const grandTotal = subtotal - discount + gstAmount;
  const paid = order.advancePaid || 0;
  const balance = order.remainingBalance || 0;

  drawLine("Subtotal", `₹${subtotal.toLocaleString('en-IN')}`, y);
  y += 16;

  if (discount > 0) {
    drawLine("Discount", `- ₹${discount.toLocaleString('en-IN')}`, y, false, "#DC2626");
    y += 16;
  }

  if (gstPercentage > 0) {
    drawLine(`GST (${gstPercentage}%)`, `+ ₹${gstAmount.toLocaleString('en-IN')}`, y, false, "#4B5563");
    y += 16;
  }

  // Grand Total highlight box
  doc.rect(summaryLeft - 8, y - 2, tableRight - summaryLeft + 8, 22).fill("#F0FDF4");
  doc.rect(summaryLeft - 8, y - 2, tableRight - summaryLeft + 8, 22).strokeColor("#BBF7D0").lineWidth(0.5).stroke();
  drawLine("Grand Total", `₹${grandTotal.toLocaleString('en-IN')}`, y + 4, true, "#1A3324");
  y += 30;

  drawLine("Amount Paid", `₹${paid.toLocaleString('en-IN')}`, y, false, "#059669");
  y += 16;

  drawLine("Balance Due", `₹${balance.toLocaleString('en-IN')}`, y, true, balance > 0 ? "#DC2626" : "#059669");
  y += 24;

  // --- Notes (left side, aligned with summary) ---
  const notesY = y - 70; // align with summary
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#6B7280").text("Notes:", ml, notesY);
  doc.font("Helvetica").fontSize(7).fillColor("#9CA3AF")
    .text("• Items once sold cannot be returned.", ml, notesY + 12, { width: 300 })
    .text("• Warranty as per manufacturer terms.", ml, notesY + 22, { width: 300 })
    .text("• Delivery dates are subject to availability.", ml, notesY + 32, { width: 300 });

  // ===========================
  // FOOTER - Fixed at bottom
  // ===========================
  const footerH = 65;
  const footerTop = pageH - footerH;
  doc.rect(0, footerTop, pageW, footerH).fill("#1A3324");

  let footerContentX = 100;
  let footerContentW = 400;

  if (settings.googleReviewUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(settings.googleReviewUrl, { margin: 1, color: { dark: '#1A3324', light: '#FFFFFF' } });
      doc.image(qrDataUrl, ml + 5, footerTop + 8, { width: 45 });
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(6).text("SCAN TO RATE", ml, footerTop + 55, { width: 55, align: "center" });
      footerContentX = 90;
    } catch (e) {
      console.error("QR Code Generation Failed:", e.message);
    }
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text("Thank you for your business!", footerContentX, footerTop + 14, { align: "center", width: footerContentW });
  doc.font("Helvetica").fontSize(6.5).fillColor("#BDBDBD").text("WE APPRECIATE YOUR TRUST IN GENESIS FURNITURE FOR YOUR HOME DECOR NEEDS.", footerContentX, footerTop + 30, { align: "center", width: footerContentW });
  doc.moveTo(footerContentX + 50, footerTop + 44).lineTo(footerContentX + footerContentW - 50, footerTop + 44).strokeColor("rgba(255,255,255,0.2)").lineWidth(0.3).stroke();
  doc.fontSize(5.5).text("PRODUCED BY GENESIS FURNITURE MANAGEMENT SYSTEM", footerContentX, footerTop + 50, { align: "center", width: footerContentW });

  doc.end();
};

module.exports = { generateInvoice };
