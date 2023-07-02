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
  assert.deepStrictEqual(result, {
    default: {
      hello: "hiiiiiiii there",
      obj: {},
    },
  });
});

test("Unresolved import throws", async (t) => {
  await assert.rejects(async () => {
    await quartz(`import foo from "bar"`);
  })
})

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

  assert.deepStrictEqual(result,
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
  t.skip("TODO: ran out of time rn");
})

test("plugin-recursive-bundler", async (t) => {
  t.skip("TODO: ohmygod this is gonna be so pain to test");
})