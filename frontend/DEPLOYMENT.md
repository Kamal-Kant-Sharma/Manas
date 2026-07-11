# Vercel Deployment Notes

## The `Cannot find module 'ajv/dist/compile/codegen'` bug

This error appears when Vercel installs the app with npm+overrides that force
`ajv` to a single version. react-scripts@5 contains a mix of legacy loaders
(fork-ts-checker, babel-loader, file-loader) that require **ajv@6**, and
newer schema-utils that require **ajv@8**. Both must coexist:

* `ajv@8` at the top of `node_modules/` (so `require('ajv/dist/compile/codegen')` resolves)
* `ajv@6` nested inside each legacy loader's own `node_modules/`

`package.json` therefore lists `ajv: ^8.17.1` as a direct `devDependency`
(hoists to the top level) and does **not** put it in `resolutions` or
`overrides` — that would flatten the tree and break the legacy loaders.

## Package manager

The project uses **yarn 1** (`yarn.lock` is committed). `vercel.json`
sets `installCommand: yarn install --frozen-lockfile` and
`buildCommand: yarn build` so Vercel matches the local environment.

If you must use npm instead, delete `yarn.lock`, remove `vercel.json`,
and run `npm install` — the same package.json will resolve correctly via
node module resolution.

## Node version

`.nvmrc` pins Node 20 (also declared under `engines.node`).
