# Rasi backend – Google Sheet (free, ~10 minutes)

The website stays on GitHub Pages. A Google Sheet is the database, and a small script (`Code.gs`) lets the site read products from it and write orders into it.

```
Customer's browser ──POST order/enquiry──▶ Apps Script ──▶ Sheet tabs: Orders, Enquiries
Customer's browser ◀──GET products──────── Apps Script ◀── Sheet tab:  Products (you edit)
```

## 1. Create the sheet
1. Go to https://sheets.google.com → **Blank spreadsheet** → name it `Rasi Studio`.
2. Open `products-template.csv` in Excel (it has your 15 current designs) → copy all → paste into the sheet's first tab. Rename that tab **Products** (exact spelling).
3. Add two more tabs named **Orders** and **Enquiries** (or run `setup()` in step 2, which creates any missing ones).

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete what's there, paste the contents of `Code.gs`, click Save.
3. (Optional) put your email in `NOTIFY_EMAIL` at the top to get a mail for each order.

## 3. Publish it
1. **Deploy → New deployment → ⚙ Web app**
2. Execute as: **Me** · Who has access: **Anyone** → Deploy → authorise when asked.
3. Copy the **Web app URL** (ends in `/exec`).
4. In `index.html`, set `const API_URL = '<that URL>';` and push to GitHub.

If you change `Code.gs` later: **Deploy → Manage deployments → Edit → New version**. The URL stays the same.

## Products tab – columns
| column | meaning |
|---|---|
| id | unique number per product, never reuse. Blouses use 101+, tassels 201+ |
| name, category, price, desc | shown on the card. `category` is one of: Women, Men, Kids, Teen, Couple, Senior, Saree (these show under Featured Designs), Blouse, Tassel (these update the Blouse / Tassel sections). `price` is a number in **rupees**, e.g. `3499` |
| image | see below |
| colours | optional, comma separated, e.g. `Rose,Blue,Ivory`. Allowed names: Rose, Maroon, Camel, Blue, Forest Green, Gold, Plum, Black, Ivory. Blank = all of them (not used for tassels) |
| sizes | optional, comma separated, e.g. `S,M,L,XL`. Blank = default sizes for the category |
| active | `Y` to show, `N` to hide (don't delete rows – old orders refer to the id) |

Change a price or add a row in the sheet and the website updates on next page load. No code, no GitHub.

## Images – three easy ways (put the result in the `image` column)
Excel itself can't upload pictures; the sheet stores a *link or file name* and the site shows that picture.

1. **Google Drive (easiest, no GitHub):** upload photo to Drive → right-click → Share → *Anyone with the link* → Copy link → paste into the `image` cell.
2. **Any web link** to an image (https://…).
3. **File in the repo:** put `silk-lehenga.jpg` in the `images/` folder on GitHub, then type just `silk-lehenga.jpg` in the cell.

Tip: use portrait photos (3:4). Keep files under ~500 KB for fast loading. If `image` is blank, the illustration is shown.

## Orders / Enquiries tabs
Every order and "Design Your Perfect Outfit" form lands as a new row with `Status = New`. Change Status to `Confirmed`, `Stitching`, `Shipped`, etc. as you work. The Orders tab also records the customer's **UPI Ref / UTR** and flags `CHECK AMOUNT` if the paid amount differs from the total; match each UTR against your bank/UPI app before shipping. Prices on orders are taken from the Products tab, not from the customer's browser, so they cannot be tampered with.

## Limits to know
- Free Google quota is plenty for a small shop (thousands of rows, ~20k script calls/day).
- UPI payment is **customer-confirmed**: the site shows your QR/UPI ID, the customer pays and types the UTR number, and the order is saved. The site cannot check with the bank that money arrived, so verify each UTR in your UPI app. A fully automatic check needs a payment gateway (e.g. Razorpay) with a server.
- Customer details are stored in your private sheet; only the script can write to it and the public can only *read the product list*.

## UPI setup (in `index.html`)
Near the top of the cart script set:
```js
const UPI_ID = 'yourname@okhdfcbank';   // your real UPI ID
const UPI_QR_IMAGE = '';                // optional: 'images/upi-qr.png' to show your own QR instead
```
With only `UPI_ID` set, the site generates a QR with the exact order amount filled in.
