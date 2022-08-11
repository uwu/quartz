export default (provided = {}) => {
  return {
    resolve({ name, store, accessor }) {
      if (!provided[name]) return;

      // we do this in case the name is something weird
      let stringified = JSON.stringify(name);
      store[stringified.slice(1, -1)] = provided[name];

      return `${accessor}[${stringified}]`;
    },
  };
};
