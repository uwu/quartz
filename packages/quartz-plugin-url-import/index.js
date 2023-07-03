export default ({baseUrl = "https://esm.sh/", existingUrls = true} = {}) => {
  return {
    resolve({ name }) {
      if (name.startsWith(".") || name.startsWith("/")) return; // local url

      // npm package
      if (!/^\w+:/.test(name) && baseUrl) {
        name = baseUrl + name;
      }
      else if (!existingUrls) return;

      return `await import("${name}")`;
    },
  };
};
