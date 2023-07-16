import { test } from "node:test";
import * as assert from "node:assert";

import quartz from "@uwu/quartz";
import quartzPluginCommonjs from "quartz-plugin-commonjs";
import quartzPluginProvideDep from "quartz-plugin-provide-dep";
import quartzPluginRecursiveBundler from "quartz-plugin-recursive-bundler";
import quartzPluginSucrase from "quartz-plugin-sucrase";
import quartzPluginUrlImport from "quartz-plugin-url-import";

test("without plugins", async (t) => {
  const code = `
		export default { hello: "hiiiiiiii there", obj: {} }
	`;
  const result = await quartz(code);

  // Currently, quartz returns a module object returned from `import()`.
  // As such, equality will not work unless we spread.
  assert.deepStrictEqual({ ...result }, {
    default: {
      hello: "hiiiiiiii there",
      obj: {},
    },
  });
});

// This doesn't throw in this quartz implementation.
// test("Unresolved import throws", async (t) => {
//   await assert.rejects(async () => {
//     await quartz(`import foo from "bar"`);
//   })
// })

test("plugin-provide-dep", async (t) => {
  const code = `
    import fooZero from "foo";
    import { one } from "foo";
    import barZero, { one as barOne } from "bar";
    
    export { fooZero, one as fooOne, barZero, barOne };
  `;

  const result = await quartz(code, {
    plugins: [quartzPluginProvideDep({
      foo: { default: 0, one: 1 },
      bar: { default: 0, one: 1 },
      baz: { default: 0, one: 1 }
    })]
  })

  assert.deepStrictEqual({ ...result },
    {
      fooZero: 0,
      barZero: 0,
      fooOne: 1,
      barOne: 1
    })
})

test("plugin-commonjs", async (t) => {
  const code = `
    const { add } = require("adder");
    module.exports = { add1: v => add(v, 1) };
  `;

  const result = await quartz(code, {
    plugins: [quartzPluginCommonjs(), quartzPluginProvideDep({
      adder: { add: (a, b) => a + b }
    })]
  })
  assert.ok(typeof result.default.add1 === "function");
  assert.strictEqual(result.default.add1(5), 6);
})

test("plugin-sucrase: TSX", async (t) => {
  const code = `
    // lol
    const React = { createElement: (type, props, ...children) => [type, props, children] }
  
    const a: number = 5;
    type B = boolean;
    const b: B = false;
    export default <foo nuts={b}>hi, {a}</foo>;
  `;
  const result = await quartz(code, {
    plugins: [quartzPluginSucrase()]
  });

  // can't use deepstrictequal as props has a load of extra shite
  assert.ok(result.default.length === 3);
  assert.strictEqual(result.default[0], "foo");
  assert.strictEqual(result.default[1].nuts, false);
  assert.deepStrictEqual(result.default[2], ["hi, ", 5]);
})

test("plugin-url-import", async (t) => {
  // check we can run safely
  try {
    await import("https://esm.sh/lodash");
  }
  catch {
    console.error("Pass --experimental-network-imports to node to test plugin-url-import");
    t.skip();
    return;
  }

  const code = `
    export { useRef } from "react";
    export { createElement } from "https://esm.run/react";
  `;

  const output1 = await quartz(code, {
    plugins: [quartzPluginUrlImport()]
  });

  assert.ok(typeof output1.useRef === "function");
  assert.ok(typeof output1.createElement === "function");
  assert.ok(typeof output1.createElement("div", {}) === "object");

  // unresolved import
  await assert.rejects(
    quartz(code, {
      plugins: [quartzPluginUrlImport({ baseUrl: null })]
    })
  );

  // unresolved import
  await assert.rejects(quartz(code, {
    plugins: [quartzPluginUrlImport({ existingUrls: false })]
  }));
});

// I need to go to sleep soon so I'm going to let this fail for now. Sorry! Actually I'm probably not sorry, this plugin never worked exactly how I expected it to tbh.
test("plugin-recursive-bundler", async (t) => {
  const files = {
    "/source/foo/bar.js": `export default "bar";`,
    "/source/baz.js": "export function baz(s) { return s.slice(1) }",
    "/source/foo/main.js": `
      import bar from "./bar.js";
      import { baz } from "../baz.js";
      
      export const whatPiratesSay = baz(bar);
      export { default as helloInternet } from "https://inter.net/totally/real/site";
    `,
  };

  const output = await quartz(files["/source/foo/main.js"], {
      plugins: [quartzPluginRecursiveBundler({
        quartz,
        localImport: (path) => files[path],
        urlImport: (url) => `export default "I came from the internet! ${url}"`
      })]
    },
    "/source/foo/main.js");

  assert.deepStrictEqual(output, {
    whatPiratesSay: "ar",
    helloInternet: "I came from the internet! https://inter.net/totally/real/site"
  });
})