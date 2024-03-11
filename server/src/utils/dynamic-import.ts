const dynamicImport = async (packageName: string) =>
  new Function(`return import('${packageName}')`)();

export default dynamicImport;
