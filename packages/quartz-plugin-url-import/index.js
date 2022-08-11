export default (baseUrl ="https://esm.sh/") => {
  return {
    resolve({ name }) {
      if (name.startsWith("http:") || name.startsWith("https:")) return;

      return `await import("${baseUrl}${name}")`;
    },
  };
};
