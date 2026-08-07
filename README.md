# RUMBLE Auto Website

Static website for RUMBLE Auto, deployed from GitHub Pages at
`https://www.rumbleauto.com.au/`.

## Local preview

```bash
python3 -m http.server 8052
```

Then open `http://localhost:8052/`.

## Structure

- `index.html` and `index_mobile.html`: home pages
- `models.html`, `services.html`, `fleet-finance.html`: main desktop pages
- `*_mobile.html`: mobile equivalents
- `styles.css` and `styles_mobile.css`: desktop and mobile styles
- `script.js` and `script_mobile.js`: page interactions
- `enquiry.js`: enquiry form submission
- `promo.js`: home-page promotion dialog
- `cookie-consent.js` and `consent-init.js`: analytics consent
- `assets/`: images, brochures and static media
- `deploy/cloudflare-worker.js`: optional production edge headers and redirects

Assets are served from the site's `/assets` directory. There is no separate CDN
configuration file.

## Production deployment

GitHub Pages does not process the repository's `_headers` file and cannot create
HTTP redirects. To enable the security headers and the `/contact.html` redirect,
deploy `deploy/cloudflare-worker.js` on a Cloudflare route covering
`www.rumbleauto.com.au/*`. Keep the GitHub Pages custom domain as the origin.

After deployment, verify:

```bash
curl -I https://www.rumbleauto.com.au/
curl -I https://www.rumbleauto.com.au/contact.html
```

The home page should include the security headers, and `/contact.html` should
return a permanent redirect to `/#contact`.

## Publishing changes

```bash
git add -A
git commit -m "Describe the change"
git push origin main
```

GitHub Pages normally publishes the updated branch within a few minutes.
