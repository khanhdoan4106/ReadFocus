# Checklist for you (Developer Dashboard)

Nothing below has been done or uploaded. These are the steps only you can do.

## Before uploading

- [ ] Merge the PR that contains this folder, so the privacy-policy URL in `listing.*.md` resolves.
- [ ] Decide the final extension name (the repo calls "ReadFocus" a temporary name). If it changes, update `public/_locales/*/messages.json`, the listings and the screenshots.
- [ ] Release: follow "Phát hành" in `docs/WORKFLOW.md` (bump `version` in `package.json` and `manifest.json`, tag, wait for the Release workflow). Upload the zip from the release, not a local build.
- [ ] Load unpacked from `dist/` and walk through the manual checks in `PROGRESS.md`.
- [ ] Regenerate the screenshots if the UI changed: `npm run build`, then `npm run screenshots`. Look at each image.

## In the Dashboard

- [ ] Register a developer account (one-time fee; see the Chrome Web Store registration page for the current amount).
- [ ] Package: upload the release zip.
- [ ] Store listing: paste text from `listing.en.md` (default) and add the Vietnamese localization from `listing.vi.md`.
- [ ] Graphic assets: the 128×128 store icon comes from the package (`public/icons/icon-128.png`); upload `store/screenshots/en/*.png` and `vi/*.png` (1280×800, at least 1, up to 5 per language).
- [ ] Optional graphics not made yet: small promo tile 440×280, marquee 1400×560. Without the small tile the listing is shown after those that have one.
- [ ] Category: choose Productivity (check the sub-category names in the dropdown).
- [ ] Privacy practices: single purpose and permission justifications from `permissions.md`; remote code = No; data-usage ticks and certifications from `data-usage.md`; privacy policy URL.
- [ ] Distribution: visibility and regions as you prefer. The account contact email and its verification are done in the Dashboard.
- [ ] If there is a "Test instructions" box: say the AI features need the user's own key, and that the AI text in the screenshots is sample output.
- [ ] Submit for review only when you are ready; review can take days.

## After approval

- [ ] Install from the store listing in a clean Chrome profile and repeat the manual checks.
