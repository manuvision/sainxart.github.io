# Duo interactive study

Independent interactive recreation by Manu Vision. This experience is not an Apple product page or an Apple endorsement.

The 3D geometry, folding rig, responsive camera, touch interaction, and liquid-glass slider are implemented specifically for this experience. No Apple webpage interface or product-viewer code is included.

## References

- Apple iPhone Duo product and folding demonstration: https://www.apple.com/iphone-duo/
- Official announcement (September 9, 2026): https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/
- Technical dimensions: https://www.apple.com/iphone-duo/specs/
  - Open: 164.6 × 117.8 × 5.2 mm
  - Closed: 84.1 × 117.8 × 11.3 mm
  - This is a visual study, not an engineering CAD model.
- Apple Duo wallpaper distributed by iClarified: https://www.iclarified.com/102102/download-the-official-iphone-duo-wallpaper-here
  - Inner Light: https://www.iclarified.com/files/ios/iClarified-iPhone-Duo-Wallpaper/iClarified-iPhone-Duo-Wallpaper-Inner-Light.jpg
  - Outer Light: https://www.iclarified.com/files/ios/iClarified-iPhone-Duo-Wallpaper/iClarified-iPhone-Duo-Wallpaper-Outer-Light.jpg
  - Converted to optimized WebP assets. Artwork belongs to its respective owner.

## Interaction

Slide to open or close. Touching the phone snaps it to the nearest fully open or closed position, then dragging rotates it. Touching or adjusting the slider smoothly restores the straight-on view. On the slider, Home closes and End opens. The introduction respects reduced motion. Rendering pauses when the scene settles or the tab is hidden.

## Build

From `source/`, run `npm ci` and `npm run build`. The self-contained build outputs `../app.js`. The experience is served as static files by the existing manu.vision GitHub Pages deployment. No third-party services or runtime CDN dependencies are required.

Dependencies: Three.js 0.180.0 (MIT) and esbuild 0.25.10 (MIT).

## Exact lock-screen typography and transition

The time and on-screen system controls use the original transparent artwork referenced by Apple's public Duo viewer, preserving the custom San Francisco numerals and glass shading:

- https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/CRqwzvoYesuhNwK/lockscreen_ui_inner-wallpaper_png.avif
- https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/CRqwzvoYesuhNwK/lockscreen_ui_outer-wallpaper_png.avif

The independent screen renderer uses two passes of bicubic mip-level defocus before ray-plane projection. The blur spreads across the image, fades heavily defocused regions to black, and combines with a broad left-side inner shadow. Its blur ranges and hinge timing were studied directly from Apple's official viewer and checked against the live demonstration. The inner display joins exactly at its rotation axis with continuous UVs and no reflective crease. This is a reconstruction of the effect, not the original Apple viewer.

The unlabelled slider thumb follows Apple's Liquid Glass control guidance: continuous adjustment, a clearer glass material during interaction, stretch under motion, and a damped settling response. Native HTML range semantics preserve keyboard and assistive-technology access.

- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/videos/play/wwdc2025/284/
- https://developer.apple.com/design/human-interface-guidelines/sliders
- https://gizmodo.com/iphone-duo-hands-on-2000808932
- https://www.reddit.com/r/PhoneNow/comments/1wc634v/this_iphone_duo_animation/

The page heading uses SF Pro Display Semibold and the credit uses SF Pro Text Regular, from Apple's public website font assets:

- https://www.apple.com/wss/fonts/SF-Pro-Display/v3/sf-pro-display_semibold.woff2
- https://www.apple.com/wss/fonts/SF-Pro-Text/v3/sf-pro-text_regular.woff2

The heading font and #0066CC credit link were checked against https://www.apple.com/ca/iphone-duo/. The outer screen returns to its complete lock-screen artwork at both fold endpoints, so the transitional projection cannot clip its image when the open phone is rotated. The rounded titanium frame and complete screen-to-back stack follow the published 5.2 mm open thickness.
