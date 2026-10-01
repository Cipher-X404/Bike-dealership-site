// Node module hooks: stub CSS and asset imports so app ESM graph loads in Node.
export async function load(url, context, next) {
  if (url.endsWith('.css')) {
    return { format: 'module', source: 'export default {};', shortCircuit: true };
  }
  if (/\.(jpg|jpeg|png|webp|gif|svg|avif|ico|mp4|webm|woff2?|ttf|otf|mp3|ogg)$/.test(url)) {
    return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
  }
  return next(url, context);
}
