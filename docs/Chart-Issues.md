# Chart Issues

## Charts Not Rendering

If charts appear blank or do not load:

1. **Check for JavaScript errors** — open the browser developer tools (F12) → Console tab. Look for errors from the charting library (Recharts).
2. **Check data exists** — charts only render if there is data for the selected month or time range. Try switching to **All Time** on the Reports page.
3. **Try a hard refresh** — press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (macOS) to clear the browser cache.
4. **Try a different browser** — see [[System Requirements\|System-Requirements]] for supported browsers.

## Charts Show Incorrect Data

- Verify the month or time range filter. Charts reflect the currently selected period.
- If income or expense entries are missing, check that they have appropriate **Start Date** / **End Date** settings and that their recurrence type includes the selected month.
- For the Household page, verify that the relevant entries have the **Household** flag enabled.

## Colour Palette Issues

If chart colours are difficult to distinguish:

- Go to **Settings** → **Colour Blindness Palettes** and select a palette suited to your colour vision.
- Available palettes: Default, Deuteranopia, Protanopia, Tritanopia.

See [[Customisation]] for details.

## Browser Compatibility

BasicBudget's charts use SVG rendering via Recharts. They require a modern browser with full SVG support:

- Chrome/Chromium 90+
- Firefox 90+
- Safari 15+
- Edge 90+

Internet Explorer is not supported.

## Charts Not Printing Correctly

When printing or saving as PDF, use the browser's print function with "Background graphics" enabled in print settings. Dark mode charts may print poorly — switch to Light theme before printing.

---

<p>
  <span style="float:left;">← Back: [[Database Problems|Database-Problems]]</span>
  <span style="float:right;">[[Resetting the Application|Resetting-the-Application]] →</span>
</p>
<div style="clear:both;"></div>
