# Release Process

This page documents the steps for publishing a new BasicBudget release.

## Semantic Versioning

BasicBudget follows [Semantic Versioning 2.0.0](https://semver.org/):

| Bump | When to use | Example |
|---|---|---|
| **MAJOR** | Incompatible API changes, breaking data format changes, major architectural shifts | v2.0.0 → v3.0.0 |
| **MINOR** | Backward-compatible new features or non-breaking enhancements | v2.1.0 → v2.2.0 |
| **PATCH** | Backward-compatible bug fixes, security patches, documentation updates | v2.1.0 → v2.1.1 |

## Release Checklist

Run these steps in order:

### 1. Bump `package.json`

Update the `"version"` field on the feature/fix branch, as part of the same PR:

```json
{
  "version": "2.24.0"
}
```

The sidebar reads the version directly from `package.json` at runtime — if it is not updated, the wrong version is displayed.

### 2. Merge PR to `master`

Merge the PR after review and approval. Do not tag before merging.

### 3. Pull `master`

```bash
git checkout master
git pull
```

### 4. Tag the Release

```bash
git tag v2.24.0
git push origin v2.24.0
```

### 5. Create and Publish the GitHub Release

```bash
gh release create v2.24.0 --title "v2.24.0" --notes "Release notes here..."
gh release edit v2.24.0 --draft=false --latest
```

## CI / Docker

- **GitHub Actions** (`.github/workflows/docker-publish.yml`) triggers on `master` push and `v*` tags.
- `master` push → publishes the `latest` Docker tag to GHCR.
- `v*` tag push → publishes a versioned tag (e.g. `v2.24.0`) to GHCR.

## Breaking Changes

If the release contains breaking changes, they must appear at the very top of the release notes:

```
## ⚠️ Breaking Changes

### <Short title>
**What changed:** <What is different>
**Why:** <The reason>
**Action required:** <What the user must do>

---
```

If there are no breaking changes, omit this section entirely.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Testing">Testing</a></td>
<td align="right"></td>
</tr>
</table>
