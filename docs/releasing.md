# Releasing Vault Loom

This checklist covers release preparation for the Obsidian Community Plugins directory. The first public release is version `1.0.0`, with plugin id `vault-loom` and minimum Obsidian version `1.13.1`.

## Automated release contract

- `manifest.json`, `package.json`, and the current `versions.json` entry must use the same version.
- A release tag must exactly match the manifest version, without a `v` prefix.
- `npm run verify` must pass and produce `main.js`.
- A GitHub release must contain `main.js`, `manifest.json`, and `styles.css`.
- Tag pushes run `.github/workflows/release.yml`, attest the build output, and create a Draft GitHub Release for manual review.

Run a local release check for the intended tag:

```sh
npm ci
npm run verify
npm run release:check -- 1.0.0
```

For later releases, use `npm version patch`, `npm version minor`, or `npm version major`. The npm version hook updates `manifest.json` and adds the matching `versions.json` entry using the current `minAppVersion`. Review those files before pushing anything.

## Manual desktop smoke test

1. Deploy the production build with `npm run deploy:test`.
2. Reload desktop Obsidian 1.13.1 or later and enable Vault Loom.
3. Confirm settings persist and `Vault Loom: Test Provider` succeeds.
4. Confirm ordinary Chat streams, stops, and shows enabled context sources.
5. Confirm chat sessions persist across a plugin reload.
6. Confirm keyword search and opt-in embedding retrieval return source previews.
7. Confirm each editing command changes only the intended editor content.
8. Confirm Agent read tools are visible and each write tool requires approval.
9. Decline every write confirmation once and verify that no note changes.

## Publish a release

1. Merge the release preparation through a pull request after CI passes.
2. Create and push an annotated tag that exactly matches `manifest.json`:

   ```sh
   git tag -a 1.0.0 -m "1.0.0"
   git push origin 1.0.0
   ```

3. Wait for the Release workflow to create the Draft GitHub Release.
4. Inspect the attestation and download all three assets to verify their names and contents.
5. Add concise release notes, then publish the draft.
6. Confirm the public release title and tag are both exactly `1.0.0`.

## Initial Community Plugins submission

Before submitting, confirm that the default branch contains `README.md`, `LICENSE`, `manifest.json`, and `versions.json`, and that the public GitHub release is downloadable without authentication.

Submit the repository through the Obsidian community plugin submission flow and agree to ongoing maintenance. The directory reads `manifest.json` from the default branch; subsequent plugin updates are downloaded from GitHub releases.

Official references:

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Submission requirements for plugins](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)
- [Release your plugin with GitHub Actions](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions)
- [Developer policies](https://docs.obsidian.md/Developer+policies)
