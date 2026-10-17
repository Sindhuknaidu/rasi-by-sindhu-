/**
 * Rasi by Sindhu – backend (Google Apps Script bound to a Google Sheet)
 *
 * Tabs:
 *   Products  – you edit this (id, name, category, price, desc, image, sizes, active)
 *   Orders    – written by the website when a customer places an order
 *   Enquiries – written by the website's "Design Your Perfect Outfit" form
 *
 * Setup: see backend/SETUP.md
 */

const NOTIFY_EMAIL = '';   // optional: put your email to get a mail for every order/enquiry

const PRODUCT_HEADERS = ['id', 'name', 'category', 'price', 'desc', 'image', 'sizes', 'active'];
const ORDER_HEADERS = ['Time', 'Order ID', 'Name', 'Contact', 'Address', 'Items', 'Total ($)', 'Status'];
const ENQUIRY_HEADERS = ['Time', 'Name', 'Email', 'Phone', 'For Whom', 'Dress Type', 'Fabric', 'Budget', 'Colour', 'Measurements', 'Requests', 'Status'];

/** Run once from the editor: creates the three tabs with headers and sample rows. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'Products', PRODUCT_HEADERS, [
    [1, 'Silk Bridal Lehenga', 'Women', 320, 'Heavy silk lehenga with gold zari embroidery.', '', '', 'Y'],
    [2, 'Floral Maxi Dress', 'Women', 89, 'Light chiffon with hand-embroidered florals.', '', '', 'Y']
  ]);
  ensureSheet_(ss, 'Orders', ORDER_HEADERS);
  ensureSheet_(ss, 'Enquiries', ENQUIRY_HEADERS);
}

function ensureSheet_(ss, name, headers, rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f5efe8');
    if (rows) rows.forEach(r => sh.appendRow(r));
  }
  return sh;
}

/** GET ?action=products  ->  JSON list of active products */
function doGet() {
  return json_({ products: readProducts_().filter(p => p.active) });
}

/** POST (text/plain JSON) { type: 'order' | 'enquiry', ... } */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (d.type === 'order') return json_(saveOrder_(ss, d));
    if (d.type === 'enquiry') return json_(saveEnquiry_(ss, d));
    return json_({ ok: false, error: 'unknown type' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function saveOrder_(ss, d) {
  const prices = {};
  readProducts_().forEach(p => prices[p.id] = p);   // prices come from the sheet, not the browser
  let total = 0;
  const lines = (d.items || []).map(it => {
    const p = prices[it.id];
    if (!p) return null;
    const qty = Math.max(1, Math.min(50, parseInt(it.qty, 10) || 1));
    total += p.price * qty;
    let line = qty + ' x ' + p.name + ' (#' + p.id + ') – size ' + clean_(it.size);
    if (it.custom) {
      const c = it.custom;
      line += ' – CUSTOM: fabric ' + clean_(c.fabric) + ', colour ' + clean_(c.colour) +
        (c.measure ? ', measurements ' + clean_(c.measure) : '') + (c.notes ? ', notes ' + clean_(c.notes) : '');
    }
    return line;
  }).filter(Boolean);
  if (!lines.length) return { ok: false, error: 'empty order' };

  const orderId = 'RS-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd-HHmmss');
  ensureSheet_(ss, 'Orders', ORDER_HEADERS).appendRow([
    new Date(), orderId, clean_(d.name), clean_(d.contact), clean_(d.address), lines.join('\n'), total, 'New'
  ]);
  notify_('New order ' + orderId, lines.join('\n') + '\n\nTotal $' + total + '\n' + clean_(d.name) + ' / ' + clean_(d.contact) + '\n' + clean_(d.address));
  return { ok: true, orderId: orderId, total: total };
}

function saveEnquiry_(ss, d) {
  const f = d.fields || {};
  ensureSheet_(ss, 'Enquiries', ENQUIRY_HEADERS).appendRow([
    new Date(), clean_(f.name), clean_(f.email), clean_(f.phone), clean_(f.forWhom), clean_(f.dressType),
    clean_(f.fabric), clean_(f.budget), clean_(f.colour), clean_(f.measurements), clean_(f.requests), 'New'
  ]);
  notify_('New custom enquiry', JSON.stringify(f, null, 2));
  return { ok: true };
}

function readProducts_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getDataRange().getValues();
  const h = rows.shift().map(x => String(x).trim().toLowerCase());
  const col = n => h.indexOf(n);
  return rows.filter(r => r[col('name')] !== '').map(r => ({
    id: Number(r[col('id')]),
    name: String(r[col('name')]),
    category: String(r[col('category')]).trim(),
    price: Number(r[col('price')]) || 0,
    desc: String(r[col('desc')] || ''),
    img: imageUrl_(String(r[col('image')] || '').trim()),
    sizes: String(r[col('sizes')] || '').split(',').map(s => s.trim()).filter(Boolean),
    active: String(r[col('active')]).trim().toUpperCase() !== 'N'
  }));
}

/**
 * image column accepts:
 *   - a Google Drive share link (file shared as "Anyone with the link")
 *   - any https:// image URL
 *   - a bare file name like silk-lehenga.jpg (file placed in the repo's images/ folder)
 */
function imageUrl_(v) {
  if (!v) return '';
  const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w900';
  if (/^https?:\/\//i.test(v)) return v;
  return 'images/' + v;
}

function clean_(v) {
  // strip leading = + - @ so customer text can never run as a spreadsheet formula
  return String(v == null ? '' : v).slice(0, 1000).replace(/^[=+\-@]+/, '');
}

function notify_(subject, body) {
  if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, 'Rasi: ' + subject, body);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
