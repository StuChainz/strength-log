# TestFlight Release Checklist

Use this checklist for the first iOS TestFlight build of Set - strength workout logger.

## Preflight

Run these checks before creating a build:

```sh
pnpm test
pnpm run test:core
pnpm lint
pnpm exec tsc --noEmit
git diff --check
```

Confirm release identity in `app.json`:

- `expo.name`: `Set - strength workout logger`
- `expo.slug`: `strength-log`
- `expo.version`: `1.0.0`
- `expo.ios.bundleIdentifier`: `com.stuchainz.strengthlog`
- `expo.ios.buildNumber`: `2`

Before every new App Store Connect upload, bump `expo.ios.buildNumber`.
Apple requires each uploaded build for the same app version to have a new build number.

## EAS Login And Configure

Install or update EAS CLI if needed:

```sh
npm install -g eas-cli
eas --version
```

Log in to Expo:

```sh
eas login
```

Confirm the project is linked/configured:

```sh
eas build:configure
```

## Build

Create the production iOS build for App Store/TestFlight distribution:

```sh
eas build --platform ios --profile production
```

Do not reuse the same `expo.ios.buildNumber` for a second upload.

## Submit

After the EAS build succeeds, submit it to App Store Connect:

```sh
eas submit --platform ios --profile production
```

## App Store Connect Manual Steps

Complete these in App Store Connect before or during first submission:

- Create the app record for Set - strength workout logger.
- Use bundle ID `com.stuchainz.strengthlog` unless an App Store Connect app already exists with a different bundle ID.
- Set SKU, primary language, category, age rating, and app information.
- Complete privacy details and data collection answers.
- Add required screenshots and metadata before external TestFlight review or App Store review.
- Add internal testers after the build finishes processing.

## Internal Vs External Testers

Internal testers can usually test processed builds without beta app review, as long as they are App Store Connect users with access to the app.

External testers require Beta App Review before they can install the build. Prepare the beta review notes, contact information, and any required demo details before inviting external testers.
