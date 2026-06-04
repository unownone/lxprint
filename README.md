# Thermal Printer App

This is a Vite-based application that uses Web Bluetooth to print to a cheap LX-D02 thermal printer.

## GitHub Pages

The app deploys automatically when changes are merged to `master` (see [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).

**One-time repo setup**

1. On GitHub: **Settings → Pages → Build and deployment → Source** → choose **GitHub Actions**.
2. Merge to `master`; the workflow builds with `base: /lxprint/` and publishes `dist`.

**Live URL:** https://unownone.github.io/lxprint/

> Web Bluetooth requires a [secure context](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#security) (HTTPS). GitHub Pages satisfies that; use Chrome/Edge on desktop or Android for printer pairing.