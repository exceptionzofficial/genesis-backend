const PDFDocument = require("pdfkit");
const axios = require("axios");
const QRCode = require("qrcode");

/**
 * Generates a strictly single-page A4 PDF invoice for an order.
 * @param {Object} order - The order object from MongoDB.
 * @param {Stream} stream - Output stream.
 * @param {Object} settings - Store settings (logo, phone, etc.)
 */
const generateInvoice = async (order, stream, settings = {}) => {
  // Use autoFirstPage: true but we will manage height to prevent overflow
  const doc = new PDFDocument({ margin: 0, size: 'A4' }); 

  // Pipe to provided stream
  doc.pipe(stream);

  const pageW = 595.28;
  const pageH = 841.89;
  const m = 30; // margin
  const cw = pageW - (m * 2); // content width: 535.28

  const store = settings.store_info || {
    name: "GENESIS FURNITURE",
    phone: "+91 98765 43210",
    email: "hello@genesisfurniture.com",
    website: "www.genesisfurniture.com",
    address: "Palayapalayam (RSF No 3/4, Puliankattu Thottam, 191/1, Perundurai Rd, opp. Renault Carshowroom, Indu Nagar, Erode, Tamil Nadu 638012",
    logo: ""
  };

  // --- Helper: Draw Grid Line ---
  const line = (x1, y1, x2, y2, color = "#E5E7EB", width = 0.5) => {
    doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(width).stroke();
  };

  // 1. OUTER BORDER (The Frame)
  doc.rect(m, m, cw, pageH - (m * 2)).strokeColor("#111827").lineWidth(1).stroke();

  // 2. HEADER BLOCK (Logo & Invoice Title)
  doc.rect(m, m, cw, 80).fill("#1A3324");
  
  if (store.logo) {
    try {
      const response = await axios.get(store.logo, { responseType: 'arraybuffer' });
      doc.image(response.data, m + 15, m + 15, { height: 50 });
    } catch (e) {
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(store.name, m + 15, m + 25);
    }
  } else {
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(22).text(store.name, m + 15, m + 28);
  }

  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24).text("INVOICE", m + 350, m + 28, { width: 170, align: "right" });

  // 3. ADDRESS GRID (From vs To)
  let y = m + 80;
  line(m, y, m + cw, y, "#111827", 1); // Horizontal separator

  // Box heights
  const infoH = 100;
  // BUSINESS DETAILS (Left)
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8).text("FROM", m + 15, y + 15);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text(store.name, m + 15, y + 28);
  doc.font("Helvetica").fontSize(8).fillColor("#4B5563").text(store.address, m + 15, y + 42, { width: 240, lineGap: 2 });
  doc.text(`Phone: ${store.phone}`, m + 15, y + 78);

  // Vertical divider in middle of info block
  line(m + (cw / 2), y, m + (cw / 2), y + infoH, "#111827", 1);

  // CUSTOMER DETAILS (Right)
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8).text("BILL TO", m + (cw / 2) + 15, y + 15);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text(order.customerName, m + (cw / 2) + 15, y + 28);
  doc.font("Helvetica").fontSize(9).fillColor("#4B5563").text(order.address || "Walk-in Customer", m + (cw / 2) + 15, y + 42, { width: 240, lineGap: 2 });
  doc.text(`Contact: ${order.phone}`, m + (cw / 2) + 15, y + 78);

  y += infoH;
  line(m, y, m + cw, y, "#111827", 1);

  // 4. INVOICE META (Date, ID, Status)
  const metaH = 30;
  doc.rect(m, y, cw, metaH).fill("#F3F4F6");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8);
  doc.text(`ID: ${order._id.toString().toUpperCase().slice(-8)}`, m + 15, y + 11);
  doc.text(`DATE: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, m + 160, y + 11);
  doc.text(`STATUS: ${(order.orderStatus || 'PENDING').toUpperCase()}`, m + 310, y + 11);
  doc.text(`DUE: ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : '-'}`, m + 440, y + 11);

  // Vertical lines for meta
  line(m + 145, y, m + 145, y + metaH);
  line(m + 295, y, m + 295, y + metaH);
  line(m + 425, y, m + 425, y + metaH);

  y += metaH;
  line(m, y, m + cw, y, "#111827", 1);

  // 5. THE TABLE (Header)
  const tbY = y;
  const col = [m, m + 40, m + 240, m + 320, m + 370, m + 450, m + cw];
  const th = 25;
  
  doc.rect(m, y, cw, th).fill("#1A3324");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("#", col[0], y + 8, { width: 40, align: "center" });
  doc.text("Description", col[1] + 10, y + 8);
  doc.text("Color", col[2], y + 8, { width: 80, align: "center" });
  doc.text("Qty", col[3], y + 8, { width: 50, align: "center" });
  doc.text("Rate", col[4], y + 8, { width: 80, align: "right" });
  doc.text("Total", col[5], y + 8, { width: 85, align: "right" });

  y += th;

  // 6. TABLE ROWS
  doc.font("Helvetica").fontSize(9).fillColor("#111827");
  const rowH = 22;

  order.items.forEach((item, i) => {
    line(m, y, m + cw, y); // Horizontal row line
    
    doc.text(`${i + 1}`, col[0], y + 7, { width: 40, align: "center" });
    doc.font("Helvetica-Bold").text(item.productName, col[1] + 10, y + 7, { width: 180, lineBreak: false });
    doc.font("Helvetica").text(item.colorName || "-", col[2], y + 7, { width: 80, align: "center" });
    doc.text(item.quantity.toString(), col[3], y + 7, { width: 50, align: "center" });
    doc.text(`₹${item.unitPrice.toLocaleString('en-IN')}`, col[4], y + 7, { width: 80, align: "right" });
    doc.font("Helvetica-Bold").text(`₹${(item.unitPrice * item.quantity).toLocaleString('en-IN')}`, col[5], y + 7, { width: 85, align: "right" });
    
    // Draw vertical cell lines
    col.forEach(x => line(x, y, x, y + rowH));
    
    y += rowH;
  });

  // Table Vertical lines to bottom of table
  col.forEach(x => line(x, tbY + th, x, y));

  // Bottom Border of the table
  line(m, y, m + cw, y, "#111827", 1);

  // 7. SUMMARY SECTION (Right Aligned Table)
  const sumW = 220;
  const sumX = m + cw - sumW;
  const subY = y;

  const sumRow = (label, value, isBold = false, bgColor = null, textColor = "#111827") => {
    if (bgColor) {
        doc.rect(sumX, y, sumW, 22).fill(bgColor);
    }
    doc.rect(sumX, y, sumW, 22).strokeColor("#111827").stroke();
    doc.fillColor(textColor).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    doc.text(label, sumX + 10, y + 7);
    doc.text(value, sumX + 110, y + 7, { width: 100, align: "right" });
    y += 22;
  };

  sumRow("Subtotal", `₹${order.totalAmount.toLocaleString('en-IN')}`);
  if (order.discount > 0) sumRow("Discount (-)", `₹${order.discount.toLocaleString('en-IN')}`, false, null, "#B91C1C");
  if (order.gstAmount > 0) sumRow(`GST (${order.gstPercentage}%)`, `₹${order.gstAmount.toLocaleString('en-IN')}`);
  
  const grandTotal = order.totalAmount - (order.discount || 0) + (order.gstAmount || 0);
  sumRow("Grand Total", `₹${grandTotal.toLocaleString('en-IN')}`, true, "#F0FDF4", "#166534");
  sumRow("Advance Paid", `₹${order.advancePaid.toLocaleString('en-IN')}`, false, null, "#047857");
  sumRow("Balance Due", `₹${order.remainingBalance.toLocaleString('en-IN')}`, true, "#FEF2F2", "#B91C1C");

  // 8. NOTES & QR (Bottom Left)
  let footerY = subY + 15;
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text("TERMS & CONDITIONS:", m + 15, footerY);
  doc.font("Helvetica").fontSize(7).fillColor("#4B5563").text("1. Items once sold cannot be returned.\n2. Warranty as per manufacturer terms.\n3. Goods remain property of Genesis until fully paid.\n4. Delivery dates are estimated.", m + 15, footerY + 15, { width: 250, lineGap: 3 });

  if (settings.googleReviewUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(settings.googleReviewUrl, { margin: 1 });
      doc.image(qrDataUrl, m + 15, footerY + 65, { width: 60 });
      doc.fontSize(7).fillColor("#111827").font("Helvetica-Bold").text("SCAN TO RATE US", m + 15, footerY + 128, { width: 60, align: "center" });
    } catch (e) {}
  }

  // 9. SIGNATURE BOX
  const sigY = pageH - m - 40;
  line(m + 350, sigY, m + 500, sigY, "#111827", 1);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8).text("AUTHORIZED SIGNATORY", m + 350, sigY + 5, { width: 150, align: "center" });

  doc.end();
};

module.exports = { generateInvoice };
