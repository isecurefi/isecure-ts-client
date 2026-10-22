# Development and releases

[Back to the README](../README.md)

## Development

```sh
yarn install --frozen-lockfile
yarn audit
yarn format:check
yarn lint
yarn typecheck
yarn test
yarn browser:check
yarn pack:check
```

Important gates:

- `yarn generate:types` converts Swagger 2.0 to OpenAPI 3.0 and generates TypeScript types.
- `npm run check:platform-contracts` verifies the experimental ISO observation surface against its
  pinned platform contracts when the platform checkout is available.
- `yarn audit` checks dependency advisories.
- `yarn format:check` checks Prettier formatting.
- `yarn lint` runs ESLint with type-aware rules.
- `yarn typecheck` runs strict TypeScript for the SDK and examples.
- `yarn test` runs Vitest with coverage thresholds.
- `yarn browser:check` verifies the package entrypoint bundles for browser targets.
- `yarn pack:check` verifies the library-only package payload.

Examples compile separately to `dist-examples`; they are not part of the npm package payload.

## Releases

Semantic versions are prepared by Release Please from conventional commits:

- `fix: ...` creates a patch release.
- `feat: ...` creates a minor release.
- `feat!: ...` or `BREAKING CHANGE:` creates a major release.

Release Please opens a version/changelog PR. Merging that PR creates the GitHub release, and the publish workflow publishes the package to npm.

Fully automated publishing requires repository secret `RELEASE_PLEASE_TOKEN` with a fine-grained GitHub token that can write contents, pull requests, and issues. The release workflow intentionally fails without that secret, because GitHub releases created by `GITHUB_TOKEN` do not trigger the npm publish workflow.

The npm package must also be configured with a trusted publisher:

- Publisher: GitHub Actions
- Organization or user: the GitHub owner of the publishing repository (`isecurefi` for this repository)
- Repository: `isecure-ts-client`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Allowed action: `npm publish`

## Generated contracts

The checked-in OpenAPI contract is [`wsapi_v2.json`](../wsapi_v2.json), pinned to the upstream revision in [`wsapi_v2.source.json`](../wsapi_v2.source.json). It describes API `v2.17.0`, copied exactly from the committed owning WS API repository. The source metadata identifies that repository, path, revision and digest. The additive account public-key field is qualified on gpgtest first; production deployment is separate. The [live REST API reference](https://www.isecure.fi/wsapi_v2/) may retain the preceding production contract until its explicit publication. Published examples include website sanitization and SDK samples.

## Supported Operations

Generated request and response types are built from `wsapi_v2.json` with `swagger2openapi` and `openapi-typescript`.

All operations in `wsapi_v2.json` are now represented by `WSChannel` methods. The operation list is exported as `SUPPORTED_OPERATIONS`; `UNSUPPORTED_OPERATIONS` is empty.
See the [exported operation list](../src/lib/api-types.ts) rather than maintaining a second list here.

## Catalogue compatibility checks

For local catalogue compatibility qualification, build the candidate and run
`node scripts/qualify-plugin-catalogue-compatibility.mjs /absolute/path/to/installed/isecure-ts-client`.
The retained package must be released 4.0.0. This exercises real SDK transports with synthetic server
responses across 18 combinations: empty listings, two release versions with additive metadata, and
mixed malformed transport members. It checks exact response preservation, format-2 diagnostics and
the explicit legacy refusal/fallback. This is transport qualification; caller/native admission owns
malformed-entry isolation, signatures, compatibility and authorization. It does not certify a live
deployment or native plugin execution.
