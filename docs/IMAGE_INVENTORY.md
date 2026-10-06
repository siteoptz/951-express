# Image Inventory

Source: `pictures/` (also zipped as `pictures.zip`). Each image was opened and viewed. Nothing has been moved or converted yet.

| # | File | Pixels | Size | What it shows | Proposed section |
|---|---|---|---|---|---|
| 1 | `1462738097176575252.JPG` | 1600×1200 (4:3) | 296 KB | Red 951 Express Freightliner Cascadia with a 5-car hauler loaded, at a fuel stop at night. Dark navy sky, amber marker lights. Truck fills the left two-thirds; empty pavement on the right. | **Hero** (best fit for the navy gradient; see flag) |
| 2 | `4954054071354628248.JPG` | 1600×1200 (4:3) | 337 KB | White Cascadia (unit 951) with a loaded hauler (sedans, SUV, red classic, pickup), bright blue sky and clouds. USDOT and MC numbers legible on the door. | **About** (fleet photo) |
| 3 | `64ef2c00-1564-47c7-8a02-59f34ca6e6dc.JPG` | 2048×1536 (4:3) | 1.2 MB | Red Cascadia, full side profile with a loaded hauler (Trans Am, Lexus SUV, Subaru, etc.) on a gravel lot, dramatic blue sky. Truck is in the left third; roughly the bottom 45% is empty gravel. | **Gallery** (hero alternate; see flag) |
| 4 | `IMG_20231007_104110_826.JPG` | 1500×1500 (1:1) | 549 KB | Low-angle, wide-lens front three-quarter of a white Cascadia, chrome wheels and bumper, deep blue sky. 951 Express Inc door logo is clear. | **Services** (personal/dealer card) or Gallery |
| 5 | `IMG_20260606_191132_361.WEBP` | 1500×1500 (1:1) | 357 KB | Black-and-white shot of a white Cascadia hauling 8 cars, near an "Exit Only" sign. Moody sky. | **Gallery** (stylistic accent) |

## Flags

- **Hero resolution:** #1 (originally proposed hero) is only 1600px wide, so it fails the 2000px hero rule; #3 (2048px) is the hero instead. A higher-resolution hero from the client would still help.
- **Hero alternate:** #3 is the highest-resolution image, but its lower half is empty gravel, so it needs a crop or a `object-position: top` treatment.
- **No logo, trust badges, or interior or office photos** were supplied. `logos/` will stay empty until the client sends a logo. The wordmark "951 EXPRESS" is the fallback.
- **Trucks vary:** two red trucks (#1, #3) and three white (#2, #4, #5). Mixed fleet colors are fine in a gallery, but the hero and About pairing should be intentional.
- **Visible identifiers:** license plates in #1, #2 and #5 are now blurred (approved). USDOT/MC numbers on the doors are left readable.
- **#5 is black and white** and will not match the brand palette. It works best as a gallery accent.
- Customer vehicles are visible on the trailers in all five. Nothing identifiable beyond the plates.
- **Alt text** will be written per image in Phase 1 (for example, "951 Express car hauler loaded with five vehicles at night").

## Final assignments (approved)

Rules: hero must be at least 2000px wide and show a truck or carrier (not a close-up); no photo is used twice; weak fits become labeled placeholders.

| Output file | Source | Size | Notes |
|---|---|---|---|
| `public/images/hero/red-cascadia-profile.webp` | #3 | 2048×1536, 683 KB | The only image meeting the 2000px rule, so it replaces #1 as hero. Bottom half is empty gravel: use `object-position: top` or a crop in Phase 1. |
| `public/images/about/white-cascadia-loaded.webp` | #2 | 1600×1200, 194 KB | Plate blurred. |
| `public/images/services/white-cascadia-front.webp` | #4 | 1500×1500, 347 KB | No readable plate. |
| `public/images/gallery/red-cascadia-night.webp` | #1 | 1600×1200, 172 KB | Plate blurred. |
| `public/images/gallery/hauler-black-white.webp` | #5 | 1500×1500, 198 KB | Plate blurred. |
| `public/images/logos/` | none | n/a | Empty: placeholder until the client sends a logo. |

License plates were blurred on #1, #2 and #5 (the only ones with a readable plate) and verified by zooming in. Run `node scripts/optimize-images.mjs` to regenerate from `originals/`.
