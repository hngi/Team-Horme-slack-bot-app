const { VM } = require("vm2");
module.exports = (str, timeout = 1000) => {
  const vm = new VM({
    sandbox: {},
    timeout
  });
  return vm.run(str);
};