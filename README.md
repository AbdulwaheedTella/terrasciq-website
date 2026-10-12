# TerraSciQ Analytics — website

Marketing site for TerraSciQ Analytics: spatial intelligence powered by Earth observation, AI and data science.

Static HTML, CSS and JavaScript. No framework, no build step, no dependencies to install.

## Structure

```
.
├── index.html          single-page site, one <section> per block (commented)
├── 404.html            not-found page
├── css/styles.css      all styles, organised in numbered sections matching the page
├── js/terrain.js       procedural terrain engine: hero surface, contours, land-cover and air-quality visuals
├── js/main.js          interface behaviour: nav, reveals, counters, filters, form
├── assets/img/         logo, favicons, social image, case-study figures (WebP)
├── netlify.toml        publish directory, security and cache headers
├── robots.txt
├── sitemap.xml
└── site.webmanifest
```

## Run locally

```bash
python -m http.server 4173
```

Then open http://localhost:4173.

## Deploy to Netlify

1. In Netlify choose **Add new site → Import an existing project** and connect this repository.
2. Leave the build command empty. Publish directory is `.` (already set in `netlify.toml`).
3. Deploy. Each push to `main` redeploys.

The contact form uses Netlify Forms (`data-netlify="true"`, form name `project`, with file upload and a honeypot field). After the first deploy, enable form detection under **Forms** in the Netlify dashboard and add an email notification to `terrasciq.analytics@gmail.com`. Until the site is on Netlify, the form shows a message pointing visitors to email and WhatsApp.

## Before going public

- **Search indexing is switched off.** While the site is being built, `index.html` carries `<meta name="robots" content="noindex, nofollow">` and `robots.txt` disallows all crawlers. Remove the meta tag and restore `robots.txt` (the launch version is in its comments) when the site is ready to be found.
- **Domain.** Canonical URL, Open Graph tags, JSON-LD, `robots.txt` and `sitemap.xml` point to `https://terrasciqanalytics.netlify.app/`. Search and replace when a custom domain is added.
- **LinkedIn.** The LinkedIn links point to the founder's profile. Replace with the company page once it exists.
- **Citation figures.** The About numbers (16 journal articles, 1,000+ citations, 25+ peer reviews) are as of September 2026. Update them periodically.
- **Case studies.** The work shown is published research by the founder, labelled as such. Add client projects only with written permission.

## Editing content

| To change | Edit |
| --- | --- |
| Headlines and copy | the matching `<section>` in `index.html` |
| Capabilities | `<article class="cap">` blocks |
| Case studies | `<article class="case">` blocks; additional rows are `<article class="mw">` |
| Publications | `<article class="pub">` blocks; `data-topics` drives the filter |
| Colours and type | the `:root` tokens at the top of `css/styles.css` |
| Contact details | search for `terrasciq.analytics@gmail.com` and `60102486014` |

## Figure credits

Case-study figures are reproduced from open-access articles under the Creative Commons Attribution 4.0 licence (CC BY 4.0), cropped and resized:

- `work-flood-kl.webp`, `work-flood-factors.webp`, `work-flood-ale.webp`, `console-map.webp` — Tella, A., Pham, Q. B., Zahidi, I., Fai, C. M., & Ibrahim, K. S. M. H. (2026). Advancing flood susceptibility mapping with explainable AI: A novel application of accumulated local effects (ALE). *Water Resources Management*. https://doi.org/10.1007/s11269-025-04430-0
- `work-lagos-suitability.webp` — Tella, A., Mustafa, M. R. U., Animashaun, G., et al. (2024). Data-driven landfill suitability mapping in Lagos State using GIS-based multi-criteria decision making. *International Journal of Environmental Science and Technology*. https://doi.org/10.1007/s13762-024-05803-5

The Kuala Lumpur comparison images (`kl-*.webp`: land cover, NDVI and NDBI for 2000 and 2020, and elevation) are rendered from the founder's own 30 m rasters for the Earth Systems and Environment (2025) study, with hillshade from the elevation model. The land-cover areas and change figures on the page are computed from those rasters (classes: 1 cropland, 2 vegetation, 3 water, 4 built-up, 5 bare land).

The hero surface and the air-quality surface are generated in the browser by `js/terrain.js`. They are synthetic; the air-quality one is labelled as illustrative on the page.

© 2026 TerraSciQ Analytics. All rights reserved.
