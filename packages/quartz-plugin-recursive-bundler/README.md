# Quartz recursive bundler plugin

This is a plugin for Quartz that bundles multiple files together.

## How to use

To get started, import it and register as a plugin:

```js
import quartz from "@uwu/quartz";
import recBundle from "quartz-plugin-recursive-bundler";

const res = quartz(code, {
  plugins: [
    recBundle({
      quartz,
    }),
  ],
});
```

In this state, it won't actually do anything, but we can change that by supplying some resolve functions!

Let's define an object to contain our totally real and not a demonstrational standin virtual file system,
and then hook it up to the bundler!

```js
import quartz from "@uwu/quartz";
import recBundle from "quartz-plugin-recursive-bundler";

const files = {
  "/source/foo/bar.js": `export default "bar";`,
  "/source/baz.js": "export function baz(s) { return s.slice(1) }",
  "/source/foo/main.js": `
      import bar from "./bar.js";
      import { baz } from "../baz.js";
      
      export const whatPiratesSay = baz(bar);
    `,
};

const res = quartz(
  files["/source/foo/main.js"],
  {
    plugins: [
      recBundle({
        quartz,
        // this can be async
        localImport(path) {
          return files[path];
        },
      }),
    ],
  },
  // make sure to provide the base path for relative resolution
  "/source/foo/main.js"
);
```

The bundle plugin will now bundle together all these files, and quartz will return the following object:

```js
res === { whatPiratesSay: "ar" };
```

## URL imports

If you import from a url, the `urlImport` function will be called.
It should provide the code from the url in just the same way as `localImport` provides the code from a path.

If you simply want to `fetch()` and bundle in the url content, you may import and pass `fetchUrlImport`:

```js
import recBundle, { fetchUrlImport } from "quartz-plugin-recursive-bundler";

recBundle({
  urlImport: fetchUrlImport,
});
```

This will be tree-shaken away otherwise.
