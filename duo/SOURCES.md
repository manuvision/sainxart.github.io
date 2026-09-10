# iPhone Duo — Animation by manu.vision

An independent interactive presentation by Manu Vision. It is not an Apple product page or an Apple endorsement.

## Device model and appearance

The device uses the actual public glTF mesh, textures, and Slider skeletal animation referenced by [Apple's iPhone Duo viewer](https://www.apple.com/ca/iphone-duo/). The Star White finish, cameras, buttons, ports, continuous inner display, and articulated central hinge come from that model. The asset is reoriented from its original centimetre coordinates without changing its proportions.

- [Official model](https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/gVFBvbhWgzeMQqC/megyEIopJyvbcOt/kifhkaVQkSALvmb/vroIlOhiWPzmavg.gltf)
- [Official viewer scene](https://www.apple.com/v/iphone-duo/a/static/scenes/iPhoneDuo_US_L_avif.lsd)
- [Technical specifications](https://www.apple.com/iphone-duo/specs/)
- [Star White appearance](https://www.apple.com/ca/iphone-duo/images/overview/design/design_hero__gczn1e74mwa6_large_2x.jpg)
- [Hinge close-up](https://www.apple.com/v/iphone-duo/a/images/overview/product-viewer/durability__d8uh14wcv2oi_large_2x.jpg)
- [Top edge](https://www.apple.com/v/iphone-duo/a/images/overview/highlights/highlights_durability_endframe__e2gc60lhc5me_large_2x.jpg)
- [Bottom edge and flexible inner display](https://www.apple.com/v/iphone-duo/a/images/overview/product-stories/immersive/hero-display_startframe__r42exuol7yi6_large_2x.jpg)

The implementation was checked against 111 distinct still-image families from the Canadian page and its stylesheets, including 57 images depicting the Duo, plus samples of Apple's design and hinge animations. Original Apple assets remain the property of their respective owner.

Lighting uses the original viewer's [studio EXR](https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/gVFBvbhWgzeMQqC/tJqCxWnWEQvHeHP/SfFEyQuyjAgUwjH.exr), with its separate [lens-highlight EXR](https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/gVFBvbhWgzeMQqC/tJqCxWnWEQvHeHP/ADsFgCxkeKZYiww.exr). Their linear radiance is filtered for reflections, and the original general material textures, ambient occlusion, exposure, blending and roughness detail are preserved. This provides consistent Star White shading during free rotation. Apple's viewer also changes editorial light-card arrangements with its camera poses; this presentation does not reproduce that camera-specific lighting choreography. The source retains an optional fixed `PT_SliderLanding` light-rig mode for reference, disabled in the interactive experience. The corrected default was visually checked in 12 front/rear, open/closed and tilted views.

## Screen artwork and transition

The raccoon photograph was supplied by Manu Vision for this experience. Both screens use proportional crops of that image.

The lock-screen time and controls use the transparent artwork referenced by Apple's viewer, preserving its San Francisco numerals and glass shading:

- [Inner lock-screen artwork](https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/CRqwzvoYesuhNwK/lockscreen_ui_inner-wallpaper_png.avif)
- [Outer lock-screen artwork](https://www.apple.com/v/iphone-duo/a/static/uploads/dIFKSKvliUSYOBw/MszYeqEKDgnBqxc/CRqwzvoYesuhNwK/lockscreen_ui_outer-wallpaper_png.avif)

The independent screen renderer uses two passes of bicubic mip-level defocus before ray-plane projection. Defocused regions fade to black and a broad inner shadow follows the projected image. At both endpoints the outer display returns to its complete lock screen, so rotation does not clip its image. The inner screen is one continuous skinned mesh with no added crease effect.

## Typography and control

The centered title uses SF Pro Display Semibold; the credit uses SF Pro Text Regular and Apple's #0066CC link blue.

- [SF Pro Display Semibold](https://www.apple.com/wss/fonts/SF-Pro-Display/v3/sf-pro-display_semibold.woff2)
- [SF Pro Text Regular](https://www.apple.com/wss/fonts/SF-Pro-Text/v3/sf-pro-text_regular.woff2)
- [Apple sliders guidance](https://developer.apple.com/design/human-interface-guidelines/sliders)
- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)

The unlabelled slider becomes clearer during touch, stretches under motion, and settles with a damped response. Native HTML range semantics preserve keyboard and assistive-technology access.

## Interaction

Slide to open or close. Touching the phone snaps to the nearest fully open or closed endpoint; dragging then rotates it. Touching or adjusting the slider smoothly restores a straight view. Home closes and End opens. With the phone focused, arrow keys rotate and R resets. Reduced motion skips the introduction and animated interpolation. Rendering pauses after the scene settles and while the tab is hidden.

## Build

From `source/`, run `npm ci` and `npm run build`. The bundled output is `../app.js`. All runtime assets are served from the existing manu.vision GitHub Pages site. There are no runtime CDN dependencies.

Three.js 0.180.0 and esbuild 0.25.10 are MIT licensed. The authored interaction and screen-rendering code is separate from the referenced Apple assets.
