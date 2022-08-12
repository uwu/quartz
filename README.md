# quartz

quartz is a simple JavaScript transform import utility that allows you to evaluate code with ESM imports and exports as well as do transforms on them.

# installation
`npm install @uwu/quartz`

### example

```JavaScript
// input.js
import { multiplyByTwo } from "dependency";

export default multiplyByTwo(5);

// run it with quartz!
import quartz from "quartz";
import provideDep from "quartz-plugin-provide-dep";

const ten = await quartz(inputJsCode, {
  plugins: [
    provideDep({
      dependency: {
        multiplyByTwo: (i) => i * 2,
      },
    }),
  ],
}); // this runs the code and handles the imports and exports automatically!
```
